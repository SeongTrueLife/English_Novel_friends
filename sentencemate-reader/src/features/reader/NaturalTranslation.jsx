import { useState } from 'react'

// 자연스러운 해석 (§6.2) — 하단 고정, 기본 접힘. 완성된 정답이라 미리 보면 추론을 대체해버려
// 접어서 보호(thinking 펼침과 대비되는 추론-우선 핵심). 토글로 펼친다.
export default function NaturalTranslation({ text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null

  return (
    <div className="natural-translation">
      <button
        type="button"
        className="natural-translation__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '자연스러운 해석 접기' : '자연스러운 해석 보기'}
      </button>
      {open && <p className="natural-translation__text">{text}</p>}
    </div>
  )
}
