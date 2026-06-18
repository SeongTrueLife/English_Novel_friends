import { useCallback, useEffect, useRef, useState } from 'react'
import { extractContext } from './sentenceExtractor'

// epub.js rendition의 텍스트 선택을 감지해 선택 문장·화면 위치(rect)·앞뒤 2문장을 상태로 노출.
// (v1 hooks/useTextSelection 이식 + sentenceExtractor 2문장 확장.)
// rect는 iframe 내부 range 좌표에 iframe offset을 더해 뷰포트 기준으로 — paginated 가로스크롤도 이 합산식이 자연 보정.
// 반환: { selected, prev, next, rect, clear }. 선택 해제·쪽넘김 시 초기화.
export function useTextSelection(rendition) {
  const [selection, setSelection] = useState(null) // { selected, prev, next, rect } | null
  const contentsRef = useRef(null) // 마지막 contents (clear 시 iframe range 제거용)

  const clear = useCallback(() => {
    setSelection(null)
    try {
      contentsRef.current?.window?.getSelection()?.removeAllRanges()
    } catch {
      /* iframe 접근 실패 — 무시 */
    }
  }, [])

  useEffect(() => {
    if (!rendition) return

    function handleSelected(cfiRange, contents) {
      try {
        contentsRef.current = contents
        const sel = contents.window.getSelection()
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          clear()
          return
        }
        const selected = sel.toString().trim()

        // iframe 내부 선택 좌표 → 뷰포트 좌표 (v1 합산식).
        const range = sel.getRangeAt(0)
        const r = range.getBoundingClientRect()
        const frame = contents.document.defaultView?.frameElement
        const off = frame ? frame.getBoundingClientRect() : { top: 0, left: 0 }
        const rect = {
          top: r.top + off.top,
          left: r.left + off.left,
          width: r.width,
          height: r.height,
        }

        // 섹션 전체 텍스트에서 앞뒤 2문장 추출.
        const sectionText = contents.document.body.innerText || ''
        const { prev, next } = extractContext(sectionText, selected)

        setSelection({ selected, prev, next, rect })
      } catch {
        clear()
      }
    }

    // 메인 문서 클릭/터치 → Ask AI 버튼 밖이면 선택 해제.
    function handleOutside(e) {
      if (e.target?.closest?.('.selection-askai')) return
      clear()
    }

    rendition.on('selected', handleSelected)
    rendition.on('relocated', clear) // 쪽넘김 시 해제
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('touchstart', handleOutside, { passive: true })

    return () => {
      rendition.off('selected', handleSelected)
      rendition.off('relocated', clear)
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('touchstart', handleOutside)
    }
  }, [rendition, clear])

  return {
    selected: selection?.selected ?? '',
    prev: selection?.prev ?? [],
    next: selection?.next ?? [],
    rect: selection?.rect ?? null,
    clear,
  }
}
