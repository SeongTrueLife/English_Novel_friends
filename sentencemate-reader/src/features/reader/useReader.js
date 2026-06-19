import { useEffect, useRef, useState, useCallback } from 'react'
import ePub from 'epubjs'
import { getEpub } from '../../lib/indexeddb'

// epub.js 수명주기 훅 — book/rendition 생성·정리. (v1 EpubReader.jsx에서 이식, in-place 아님)
// 핵심: rendition은 cleanup에서 반드시 destroy(메모리 누수 방지).
// epub 파일 접근은 lib/indexeddb의 getEpub만 경유(불변규칙). curated는 공개 URL(backend_design ④).
//
// 시그니처: useReader(viewerRef, bookMeta, { onCenterTap, startCfi }) → { status, prev, next }
//   status: 'loading' | 'ready' | 'missing' | 'error'
//   'missing' = user_upload인데 이 단말기 IndexedDB에 파일 없음(다른 단말기) → 재업로드 안내.
//   startCfi: 이어 읽기 복원 위치(user_books.progress_cfi, M6 #2). 없으면 처음부터.
//
// 탭존(§6.2): rendition click의 "보이는 페이지" x좌표를 3등분 — 좌 prev / 우 next / 가운데 onCenterTap.
// (paginated는 섹션 전체를 가로로 깔고 scrollLeft로 넘기므로, clientX에서 scrollLeft를 빼 페이지 기준으로 변환.)
// iframe 본문색 단일 출처(조각 C): tokens.css의 --bg-primary/--text-primary 실값을 읽어 그대로 쓴다.
//   iframe엔 CSS 변수가 안 닿으므로 JS가 구체값을 줘야 하지만, getComputedStyle로 읽으면 hex 중복 없이
//   tokens.css가 단일 출처가 된다. App.jsx가 setTheme 시 data-theme를 동기 갱신하므로 읽는 시점엔 새 테마 반영됨.
function readReaderColors() {
  const root = getComputedStyle(document.documentElement)
  return {
    color: root.getPropertyValue('--text-primary').trim() || '#2a2724',
    background: root.getPropertyValue('--bg-primary').trim() || '#fcfaf6',
  }
}

export function useReader(viewerRef, bookMeta, { onCenterTap, startCfi, fontSize, theme } = {}) {
  const [status, setStatus] = useState('loading')
  const [rendition, setRendition] = useState(null) // 선택 훅에 넘길 인스턴스(v1 방식)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)

  // 최신 onCenterTap을 effect 재실행 없이 호출(effect deps에서 제외).
  const onCenterTapRef = useRef(onCenterTap)
  useEffect(() => {
    onCenterTapRef.current = onCenterTap
  })

  // 글자 크기(조각 B) — init은 fontSize 변동으로 재실행되면 안 되므로 ref로 캡처해 1회 읽는다.
  //   appliedFontSizeRef = 현재 epub에 실제 적용된 값(변경 effect가 중복 reflow를 건너뛰는 기준).
  const fontSizeRef = useRef(fontSize)
  useEffect(() => {
    fontSizeRef.current = fontSize
  })
  const appliedFontSizeRef = useRef(null)

  // 다크모드(조각 C) — init이 theme 변동으로 재실행되지 않게 ref로 캡처. appliedThemeRef = 현재 적용된 테마.
  const themeRef = useRef(theme)
  useEffect(() => {
    themeRef.current = theme
  })
  const appliedThemeRef = useRef(null)

  // 복원 CFI도 ref로 캡처 — display는 init에서 1회만 읽고, startCfi 변동으로 책을 재로드하지 않게
  //   (EpubReader가 progress settle 후에만 book을 넘기므로 init 시점엔 이미 확정값).
  const startCfiRef = useRef(startCfi)
  useEffect(() => {
    startCfiRef.current = startCfi
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
        setRendition(rendition) // 선택 훅이 'selected' 구독하도록 노출

        // ③ 테마 — 세리프 + measure(~680px §4)는 body에서(v1 검증값). themes.default로 등록.
        //    글자 크기(조각 B)와 본문색(조각 C)은 default에 박지 않고 themes.override가 단일 출처. 아래 ③' 참조.
        rendition.themes.default({
          body: {
            'font-family': 'Georgia, "Noto Serif KR", serif',
            'line-height': '1.8',
            'max-width': '680px',
            margin: '0 auto',
            padding: '20px 32px',
          },
          p: { 'margin-bottom': '1em' },
        })

        // ③' 글자 크기·본문색 초기 적용 — display 이전에 override를 걸어 첫 페인트부터 올바른 크기/테마로.
        //     override는 content 훅에 등록돼 이후 챕터에도 자동 적용된다(epubjs themes). startCfi 복원도 이 상태에서 정확.
        const initialFontSize = fontSizeRef.current
        if (initialFontSize != null) {
          rendition.themes.fontSize(`${initialFontSize}px`)
          appliedFontSizeRef.current = initialFontSize
        }
        const initColors = readReaderColors() // data-theme는 FOUC 스크립트가 mount 전 깔아 둠 → 정확
        rendition.themes.override('color', initColors.color)
        rendition.themes.override('background', initColors.background)
        appliedThemeRef.current = themeRef.current

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
        rendition.on('click', (e, contents) => {
          // 텍스트 선택 중인 탭은 페이지를 넘기지 않음(선택 마무리 클릭과 충돌 방지).
          const sel = contents?.window?.getSelection?.()
          if (sel && !sel.isCollapsed && sel.toString().trim()) return
          const m = rendition.manager
          const pageWidth = m?.layout?.delta || viewerEl.clientWidth || 0
          if (!pageWidth) return
          const scrollLeft = m?.container?.scrollLeft || 0
          const xInPage = e.clientX - scrollLeft
          if (xInPage < pageWidth / 3) rendition.prev()
          else if (xInPage > (pageWidth * 2) / 3) rendition.next()
          else onCenterTapRef.current?.()
        })

        await rendition.display(startCfiRef.current || undefined) // 이어 읽기 복원(없으면 처음부터)
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
      setRendition(null)
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

  // 글자 크기 변경(읽는 중 A±) — store fontSize가 바뀌면 epub에 반영하고 보던 위치(CFI)를 유지(조각 B).
  // themes.fontSize는 iframe body에 CSS만 동기 적용 → 브라우저 reflow가 페이지를 다시 쪼개므로 보던 문장이 흔들린다.
  // 그래서 변경 "직전" 현재 CFI를 캡처하고, reflow가 끝난 뒤 display(cfi)로 같은 문장으로 되돌린다.
  // 복원 트리거는 "Contents 'resize'(reflow 감지) ↔ 250ms 타임아웃"을 경합 — 둘 중 먼저 오는 쪽이 단 1회만 복원:
  //   · resize: 대개 reflow 발생 시. epubjs의 silent counter(scrollBy) 직후 우리 콜백이 돌아 정확한 페이지로 안착.
  //   · 타임아웃: 크기 변화가 reflow를 안 일으켜 resize가 영영 안 뜨는 엣지 대비(없으면 위치가 어긋난 채 남음).
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || status !== 'ready') return
    if (appliedFontSizeRef.current === fontSize) return // 마운트 첫 실행·중복 reflow 방지(초기 적용분과 동일)

    const loc = rendition.currentLocation()
    const cfi = loc?.start?.cfi || null
    const contents = rendition.getContents()?.[0]

    rendition.themes.fontSize(`${fontSize}px`)
    appliedFontSizeRef.current = fontSize

    if (!cfi) return // 첫 display 전 등 — 복원할 위치 없음

    let restored = false
    let timer = null
    const restoreOnce = () => {
      if (restored) return
      restored = true
      clearTimeout(timer)
      contents?.off?.('resize', restoreOnce)
      rendition.display(cfi)
    }

    if (contents) {
      contents.once('resize', restoreOnce) // reflow 감지(counter 직후)
      timer = setTimeout(restoreOnce, 250) // resize 미발생 엣지 대비
      return () => {
        clearTimeout(timer)
        contents.off?.('resize', restoreOnce)
      }
    }
    // 표시 중인 contents가 없으면(이례적) 즉시 복원.
    rendition.display(cfi)
  }, [fontSize, status])

  // 테마 변경(다크모드, 조각 C) — store theme가 바뀌면 iframe 본문색을 갱신.
  // App.jsx가 data-theme를 동기 갱신한 뒤라 readReaderColors()는 새 테마 값을 읽는다.
  // 색 변경은 reflow를 일으키지 않으므로(글자 크기와 달리) CFI 복원 불필요 — 보던 위치 그대로.
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || status !== 'ready') return
    if (appliedThemeRef.current === theme) return // 마운트 첫 실행(초기 적용분과 동일) skip

    const { color, background } = readReaderColors()
    rendition.themes.override('color', color)
    rendition.themes.override('background', background)
    appliedThemeRef.current = theme
  }, [theme, status])

  const prev = useCallback(() => renditionRef.current?.prev(), [])
  const next = useCallback(() => renditionRef.current?.next(), [])

  return { status, rendition, prev, next }
}
