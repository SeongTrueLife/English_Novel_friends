import { useRef, useState, useEffect } from 'react'
import AIResponse from './AIResponse'
import '../styles/bottomSheet.css'

const MIN_HEIGHT_RATIO = 0.45
const MAX_HEIGHT_RATIO = 0.85
const CLOSE_THRESHOLD = 80 // 이 픽셀 이상 내리면 닫힘

function BottomSheet({ isOpen, onClose, selectedText, streamingText, isLoading, error, onAddVocab }) {
  const [sheetHeight, setSheetHeight] = useState(() => window.innerHeight * MIN_HEIGHT_RATIO)
  const [isVisible, setIsVisible] = useState(false)

  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const isDragging = useRef(false)
  const sheetRef = useRef(null)

  // 열림/닫힘 애니메이션
  useEffect(() => {
    if (isOpen) {
      setSheetHeight(window.innerHeight * MIN_HEIGHT_RATIO)
      // 한 프레임 뒤에 visible로 변경 (CSS transition 트리거)
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  // 드래그 시작
  function handleDragStart(e) {
    e.preventDefault()
    isDragging.current = true
    dragStartY.current = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
    dragStartHeight.current = sheetHeight

    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
    window.addEventListener('touchmove', handleDragMove, { passive: false })
    window.addEventListener('touchend', handleDragEnd)
  }

  function handleDragMove(e) {
    if (!isDragging.current) return
    e.preventDefault()
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY
    const delta = dragStartY.current - clientY // 위로 드래그 = 양수 = 높이 증가
    const newHeight = dragStartHeight.current + delta
    const maxH = window.innerHeight * MAX_HEIGHT_RATIO
    setSheetHeight(Math.min(maxH, Math.max(0, newHeight)))
  }

  function handleDragEnd() {
    if (!isDragging.current) return
    isDragging.current = false

    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
    window.removeEventListener('touchmove', handleDragMove)
    window.removeEventListener('touchend', handleDragEnd)

    const minH = window.innerHeight * MIN_HEIGHT_RATIO
    setSheetHeight((h) => {
      if (h < minH - CLOSE_THRESHOLD) {
        onClose()
        return minH
      }
      return Math.max(minH, Math.min(window.innerHeight * MAX_HEIGHT_RATIO, h))
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* 반투명 오버레이 */}
      <div className={`sheet-overlay ${isVisible ? 'sheet-overlay--visible' : ''}`} />

      {/* 바텀시트 */}
      <div
        ref={sheetRef}
        className={`bottom-sheet ${isVisible ? 'bottom-sheet--visible' : ''}`}
        style={{ height: sheetHeight }}
      >
        {/* 드래그 핸들 + 닫기 버튼 */}
        <div
          className="sheet-handle-bar"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="sheet-handle" />
          <button className="sheet-close-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* AI 응답 스크롤 영역 */}
        <div className="sheet-content">
          <AIResponse
            selectedText={selectedText}
            streamingText={streamingText}
            isLoading={isLoading}
            error={error}
            onAddVocab={onAddVocab}
          />
        </div>
      </div>
    </>
  )
}

export default BottomSheet
