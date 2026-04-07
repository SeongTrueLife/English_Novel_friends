import { useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import ReaderToolbar from './ReaderToolbar'
import AskAIButton from './AskAIButton'
import BottomSheet from './BottomSheet'
import { useTextSelection } from '../hooks/useTextSelection'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import '../styles/reader.css'

function EpubReader({ epubData, bookTitle, settings, onBack, onOpenSettings }) {
  const viewerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)

  const [rendition, setRendition] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheetSelectedText, setSheetSelectedText] = useState('')

  const {
    selectedText,
    beforeSentence,
    afterSentence,
    selectionRect,
    selectedElementRef,
    clearSelection,
  } = useTextSelection(rendition)

  const { streamingText, isLoading, error, callAPI, abort } = useGeminiAPI()

  // epub.js 초기화
  useEffect(() => {
    if (!epubData || !viewerRef.current) return

    const book = ePub(epubData)
    bookRef.current = book

    const r = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'none',
    })

    renditionRef.current = r

    r.display().then(() => {
      setRendition(r)
      setIsReady(true)
    })

    r.on('relocated', (location) => {
      if (location?.start?.displayed) {
        setCurrentPage(location.start.displayed.page)
        setTotalPages(location.start.displayed.total)
      }
      clearSelection()
    })

    return () => {
      book.destroy()
      setRendition(null)
    }
  }, [epubData])

  // settings 변경 시 epub 테마 재적용
  useEffect(() => {
    if (!rendition) return
    const textColor = settings.theme === 'dark' ? '#e0e0e0' : settings.theme === 'sepia' ? '#5c4b37' : '#333'
    const bgColor   = settings.theme === 'dark' ? '#1a1a2e' : settings.theme === 'sepia' ? '#f4ecd8' : '#fefefe'

    // 새로 로드될 페이지를 위한 기본 테마 등록
    rendition.themes.default({
      body: {
        'font-family': '"Georgia", "Times New Roman", serif',
        'font-size':   `${settings.fontSize}px`,
        'line-height': `${settings.lineHeight}`,
        'color':       textColor,
        'background':  bgColor,
        'padding':     '20px 32px',
        'max-width':   '680px',
        'margin':      '0 auto',
      },
      p: { 'margin-bottom': '1em' },
    })

    // 현재 표시 중인 페이지에 즉시 적용
    // epub 내부 CSS가 p/span 등에 font-size를 직접 지정하는 경우가 많아
    // body에만 설정해선 무시됨 → <style> 태그를 iframe에 직접 주입
    try {
      rendition.getContents().forEach(c => {
        if (!c.document) return

        // 기존 주입 스타일 제거 후 재생성
        const prev = c.document.getElementById('sm-injected-style')
        if (prev) prev.remove()

        const style = c.document.createElement('style')
        style.id = 'sm-injected-style'
        style.textContent = `
          body, p, div, span, li, a, blockquote,
          h1, h2, h3, h4, h5, h6 {
            font-size: ${settings.fontSize}px !important;
          }
          body {
            line-height: ${settings.lineHeight} !important;
            color: ${textColor} !important;
            background-color: ${bgColor} !important;
          }
        `
        c.document.head.appendChild(style)
      })
    } catch (e) { /* iframe 접근 실패 시 무시 */ }
  }, [rendition, settings.fontSize, settings.lineHeight, settings.theme])

  function handlePrev() { renditionRef.current?.prev() }
  function handleNext() { renditionRef.current?.next() }

  function handleAskAI() {
    if (!selectedText) return
    setSheetSelectedText(selectedText)
    setIsSheetOpen(true)
    callAPI({ selectedText, beforeSentence, afterSentence })

    // 스크롤 자동 조정: 선택 문장이 바텀시트에 가려지면 스크롤
    const sheetTop = window.innerHeight * 0.55
    if (selectionRect && selectionRect.bottom > sheetTop) {
      try {
        selectedElementRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch (e) { /* paginated 모드에서는 무시 */ }
    }
  }

  function handleCloseSheet() {
    abort()
    setIsSheetOpen(false)
    setSheetSelectedText('')
    clearSelection()
  }

  // 키보드 방향키
  useEffect(() => {
    function handleKeyDown(e) {
      if (isSheetOpen) return
      if (e.key === 'ArrowLeft')  handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSheetOpen])

  return (
    <div className="reader-container">
      <ReaderToolbar
        bookTitle={bookTitle}
        onBack={onBack}
        onOpenSettings={onOpenSettings}
      />

      <div className="reader-body">
        <div ref={viewerRef} className="epub-viewer" />

        {!isReady && (
          <div className="reader-loading">
            <div className="spinner" />
            <p>책을 불러오는 중...</p>
          </div>
        )}

        {isReady && !isSheetOpen && (
          <>
            <button className="page-btn page-btn-left"  onClick={handlePrev} aria-label="이전 페이지">‹</button>
            <button className="page-btn page-btn-right" onClick={handleNext} aria-label="다음 페이지">›</button>
          </>
        )}

        <AskAIButton selectionRect={selectionRect} onAskAI={handleAskAI} />
      </div>

      {isReady && totalPages > 0 && (
        <div className="reader-footer">{currentPage} / {totalPages}</div>
      )}

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        selectedText={sheetSelectedText}
        streamingText={streamingText}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}

export default EpubReader
