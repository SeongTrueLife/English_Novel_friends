import Markdown from './Markdown'

// thinking / sentence_thinking 한 항목 (§6.2) — 작은 틴트박스, 한 단계 낮은 위계.
// type 칩 + title + body(마크다운). 같은 {type,title,body} 구조라 둘 다 이 컴포넌트로.
const TYPE_LABEL = {
  core_image: '핵심 이미지',
  culture: '배경·문화',
  author_intent: '작가 의도',
}

export default function ThinkingCard({ type, title, body }) {
  const label = TYPE_LABEL[type] // 모르는 type는 라벨 생략(방어)
  return (
    <div className="thinking-card">
      <div className="thinking-card__head">
        {label && <span className="thinking-card__type">{label}</span>}
        {title && <span className="thinking-card__title">{title}</span>}
      </div>
      <p className="thinking-card__body">
        <Markdown text={body} />
      </p>
    </div>
  )
}
