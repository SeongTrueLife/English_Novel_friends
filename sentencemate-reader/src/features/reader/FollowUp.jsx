import { useState } from 'react'

// "더 물어보기" 입력 (§6.2 하단 고정, 채팅 스크롤 밖). design_mockups: input + 위쪽 화살표 버튼.
// 같은 문장 맥락으로 추가 질문을 보낸다(멀티턴). 전송 중엔 비활성, 전송 후 비움. Enter 전송.
export default function FollowUp({ onSend, disabled }) {
  const [text, setText] = useState('')

  const submit = () => {
    const q = text.trim()
    if (!q || disabled) return
    onSend(q)
    setText('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="followup">
      <input
        type="text"
        className="followup__input"
        placeholder="더 물어보기…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-label="더 물어보기"
      />
      <button
        type="button"
        className="followup__send"
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="보내기"
      >
        ↑
      </button>
    </div>
  )
}
