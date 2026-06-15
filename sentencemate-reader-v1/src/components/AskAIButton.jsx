import { useEffect, useState } from 'react'
import '../styles/components.css'

/**
 * 텍스트 선택 시 나타나는 플로팅 "Ask AI" 버튼
 * @param {object} selectionRect - 선택 영역의 뷰포트 좌표
 * @param {function} onAskAI - 버튼 클릭 핸들러
 */
function AskAIButton({ selectionRect, onAskAI }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!!selectionRect)
  }, [selectionRect])

  if (!selectionRect) return null

  return (
    <button
      className={`ask-ai-btn ${visible ? 'ask-ai-btn--visible' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAskAI}
      aria-label="선택한 문장 AI 설명 요청"
    >
      📖 Ask AI
    </button>
  )
}

export default AskAIButton
