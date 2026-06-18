import Markdown from './Markdown'

// 문법 학습 단위 카드 (§6.2) — pattern(제목) + explanation(마크다운 본문)
// + interpretation_guide(강조 한 줄, 틴트박스 + → ).
export default function GrammarItem({ pattern, explanation, interpretation_guide }) {
  return (
    <article className="grammar-item">
      <h4 className="grammar-item__pattern">{pattern}</h4>
      {explanation && (
        <p className="grammar-item__explanation">
          <Markdown text={explanation} />
        </p>
      )}
      {interpretation_guide && (
        <p className="grammar-item__guide">
          <span className="grammar-item__arrow" aria-hidden="true">
            →
          </span>
          <span>
            <Markdown text={interpretation_guide} />
          </span>
        </p>
      )}
    </article>
  )
}
