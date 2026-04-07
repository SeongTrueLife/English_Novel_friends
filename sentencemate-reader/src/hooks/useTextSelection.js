import { useState, useEffect, useCallback, useRef } from 'react'
import { extractContext } from '../utils/sentenceExtractor'

/**
 * epub.js rendition의 텍스트 선택을 감지하고 앞뒤 문장을 추출하는 훅
 * @param {object|null} rendition - epub.js rendition 객체
 */
/**
 * paginated 모드에서 브라우저 자동 스크롤로 어긋난 scrollLeft를
 * 가장 가까운 페이지 경계(delta 배수)로 스냅한다.
 */
function snapScrollPosition(rendition) {
  try {
    const manager = rendition?.manager
    if (!manager) return
    const container = manager.container
    const delta = manager.layout?.delta
    if (!container || !delta) return
    const current = container.scrollLeft
    const snapped = Math.round(current / delta) * delta
    if (Math.abs(current - snapped) > 1) {
      container.scrollLeft = snapped
    }
  } catch (e) { /* iframe 접근 실패 시 무시 */ }
}

export function useTextSelection(rendition) {
  const [selectedText, setSelectedText] = useState('')
  const [beforeSentence, setBeforeSentence] = useState('')
  const [afterSentence, setAfterSentence] = useState('')
  const [selectionRect, setSelectionRect] = useState(null)

  // 마지막으로 받은 contents 참조 보관 (선택 해제 시 iframe selection도 지우기 위해)
  const contentsRef = useRef(null)
  // 스크롤 조정용: 선택된 DOM 요소 참조
  const selectedElementRef = useRef(null)

  const clearSelection = useCallback(() => {
    setSelectedText('')
    setBeforeSentence('')
    setAfterSentence('')
    setSelectionRect(null)
    selectedElementRef.current = null
    // iframe 내부 실제 선택도 해제
    try {
      contentsRef.current?.window?.getSelection()?.removeAllRanges()
    } catch (e) { /* 무시 */ }
  }, [])

  useEffect(() => {
    if (!rendition) return

    function handleSelected(cfiRange, contents) {
      try {
        contentsRef.current = contents
        const iframeWindow = contents.window
        const sel = iframeWindow.getSelection()

        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          clearSelection()
          return
        }

        const text = sel.toString().trim()

        // iframe 내부의 선택 영역 좌표 → 뷰포트 좌표로 변환
        const range = sel.getRangeAt(0)
        const iframeRect = range.getBoundingClientRect()
        const iframe = contents.document.defaultView?.frameElement
        const iframeOffset = iframe
          ? iframe.getBoundingClientRect()
          : { top: 0, left: 0 }

        const viewportRect = {
          top: iframeRect.top + iframeOffset.top,
          bottom: iframeRect.bottom + iframeOffset.top,
          left: iframeRect.left + iframeOffset.left,
          right: iframeRect.right + iframeOffset.left,
          width: iframeRect.width,
          height: iframeRect.height,
        }

        // 선택 문장이 속한 <p> 또는 부모 요소에서 문장 컨텍스트 추출
        const anchorNode = sel.anchorNode
        const paragraph =
          anchorNode?.parentElement?.closest('p') ||
          anchorNode?.parentElement
        const fullText = paragraph?.textContent || ''
        const { before, after } = extractContext(fullText, text)

        selectedElementRef.current = paragraph || null

        setSelectedText(text)
        setBeforeSentence(before)
        setAfterSentence(after)
        setSelectionRect(viewportRect)

        // 텍스트 선택 중 브라우저가 scrollLeft를 어긋나게 만든 경우 보정
        snapScrollPosition(rendition)
      } catch (e) {
        clearSelection()
      }
    }

    // epub 내부 클릭 (새 선택 없이) → 버튼 숨김
    function handleEpubClick() {
      setTimeout(() => {
        const sel = contentsRef.current?.window?.getSelection()
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          clearSelection()
        }
      }, 10)
    }

    // 메인 문서 클릭 → Ask AI 버튼 클릭 제외하고 버튼 숨김
    function handleMainMouseDown(e) {
      if (e.target.closest?.('.ask-ai-btn')) return
      clearSelection()
    }

    rendition.on('selected', handleSelected)
    rendition.on('deselected', clearSelection)
    rendition.on('click', handleEpubClick)
    window.addEventListener('mousedown', handleMainMouseDown)
    window.addEventListener('touchstart', handleMainMouseDown, { passive: true })

    return () => {
      rendition.off('selected', handleSelected)
      rendition.off('deselected', clearSelection)
      rendition.off('click', handleEpubClick)
      window.removeEventListener('mousedown', handleMainMouseDown)
      window.removeEventListener('touchstart', handleMainMouseDown)
    }
  }, [rendition, clearSelection])

  return {
    selectedText,
    beforeSentence,
    afterSentence,
    selectionRect,
    selectedElementRef,
    clearSelection,
  }
}
