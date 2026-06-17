import { useEffect, useRef, useState, useCallback } from 'react'
import ePub from 'epubjs'
import { getEpub } from '../../lib/indexeddb'

// epub.js 수명주기 훅 — book/rendition 생성·정리. (v1 EpubReader.jsx에서 이식, in-place 아님)
// 핵심: rendition은 cleanup에서 반드시 destroy(메모리 누수 방지).
// epub 파일 접근은 lib/indexeddb의 getEpub만 경유(불변규칙). curated는 공개 URL(backend_design ④).
//
// 시그니처: useReader(viewerRef, bookMeta, { onCenterTap }) → { status, prev, next }
//   status: 'loading' | 'ready' | 'missing' | 'error'
//   'missing' = user_upload인데 이 단말기 IndexedDB에 파일 없음(다른 단말기) → 재업로드 안내.
//
// 탭존(§6.2): rendition click의 "보이는 페이지" x좌표를 3등분 — 좌 prev / 우 next / 가운데 onCenterTap.
// (paginated는 섹션 전체를 가로로 깔고 scrollLeft로 넘기므로, clientX에서 scrollLeft를 빼 페이지 기준으로 변환.)
export function useReader(viewerRef, bookMeta, { onCenterTap } = {}) {
  const [status, setStatus] = useState('loading')
  const bookRef = useRef(null)
  const renditionRef = useRef(null)

  // 최신 onCenterTap을 effect 재실행 없이 호출(effect deps에서 제외).
  const onCenterTapRef = useRef(onCenterTap)
  useEffect(() => {
    onCenterTapRef.current = onCenterTap
  })

  const bookId = bookMeta?.book_id
  const source = bookMeta?.source

  useEffect(() => {
    if (!bookId || !source) return
    let cancelled = false
    const viewerEl = viewerRef.current // cleanup에서 쓸 노드 캡처(렌더 후 안정)

    async function init() {
      try {
        setStatus('loading')
        // ① 소스 해석 (backend_design ④)
        let input
        if (source === 'user_upload') {
          const blob = await getEpub(bookId)
          if (cancelled) return
          if (!blob) {
            setStatus('missing') // 다른 단말기 — 파일 없음
            return
          }
          input = await blob.arrayBuffer()
        } else {
          // curated_free → 공개 URL (M2엔 시드 없어 미검증, 계약대로 배선)
          input = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/curated_books/${bookId}.epub`
        }
        if (cancelled || !viewerEl) return

        // ② book + rendition (paginated 좌우 쪽넘김)
        //    arrayBuffer는 openAs:'binary' 명시(검증된 AddBookSheet 파싱과 동일). URL이면 기본.
        const book =
          typeof input === 'string'
            ? ePub(input)
            : ePub(input, { openAs: 'binary' })
        bookRef.current = book
        const rendition = book.renderTo(viewerEl, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none',
          allowScriptedContent: true, // 책 내용 스크립트 허용 — 없으면 sandbox가 막아 빈 페이지
        })
        renditionRef.current = rendition

        // ③ 테마 — 세리프 + measure(~680px §4)는 body에서(v1 검증값). themes.default로 등록.
        rendition.themes.default({
          body: {
            'font-family': 'Georgia, "Noto Serif KR", serif',
            'font-size': '18px',
            'line-height': '1.8',
            color: '#2a2724',
            background: '#fcfaf6',
            'max-width': '680px',
            margin: '0 auto',
            padding: '20px 32px',
          },
          p: { 'margin-bottom': '1em' },
        })

        // ④ paginated scrollLeft 보정(v1 이식) — 페이지 경계에서 어긋나면 delta 배수로 스냅.
        //    이 보정이 없으면 쪽넘김 후 반쪽/빈 페이지가 됨.
        rendition.on('relocated', () => {
          try {
            const m = rendition.manager
            const container = m?.container
            const delta = m?.layout?.delta
            if (container && delta) {
              const snapped = Math.round(container.scrollLeft / delta) * delta
              if (Math.abs(container.scrollLeft - snapped) > 1) {
                container.scrollLeft = snapped
              }
            }
          } catch {
            /* 무시 */
          }
        })

        // ⑤ 탭존 — iframe 내부 클릭을 rendition click으로 받음(부모로 안 올라옴).
        //    주의: paginated는 섹션 전체를 가로로 깔고 container.scrollLeft로 페이지를 넘긴다.
        //    e.clientX는 스크롤된 iframe 문서 좌표라 scrollLeft가 포함됨 → 빼서 "보이는 페이지" 기준으로 변환.
        //    (안 빼면 페이지가 넘어갈수록 clientX가 커져 항상 next로만 감.)
        rendition.on('click', (e) => {
          const m = rendition.manager
          const pageWidth = m?.layout?.delta || viewerEl.clientWidth || 0
          if (!pageWidth) return
          const scrollLeft = m?.container?.scrollLeft || 0
          const xInPage = e.clientX - scrollLeft
          if (xInPage < pageWidth / 3) rendition.prev()
          else if (xInPage > (pageWidth * 2) / 3) rendition.next()
          else onCenterTapRef.current?.()
        })

        await rendition.display() // CFI 복원은 M6 — 인자 없이 처음부터
        if (cancelled) return
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        console.error('리더 로딩 실패:', err)
        setStatus('error')
      }
    }
    init()

    // cleanup — 반드시 destroy(메모리). StrictMode 이중 마운트/소스 변경에도 안전.
    return () => {
      cancelled = true
      if (bookRef.current) {
        try {
          bookRef.current.destroy()
        } catch {
          /* 이미 파괴됨 — 무시 */
        }
        bookRef.current = null
        renditionRef.current = null
      }
      if (viewerEl) viewerEl.innerHTML = ''
    }
  }, [bookId, source, viewerRef])

  const prev = useCallback(() => renditionRef.current?.prev(), [])
  const next = useCallback(() => renditionRef.current?.next(), [])

  return { status, prev, next }
}
