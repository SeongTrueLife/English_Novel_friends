import Markdown from './Markdown'
import { useSaveCard } from './useSaveCard'

// 문법 학습 단위 카드 (§6.2) — pattern(제목) + explanation(마크다운 본문)
// + interpretation_guide(강조 한 줄, 틴트박스 + → ).
// 우상단 ⊕: 1카드로 저장(M5). example_sentence·chapter는 클라가 첨부(불변규칙 5).
export default function GrammarItem({
  pattern,
  explanation,
  interpretation_guide,
  bookId,
  exampleSentence,
  chapter = null,
  onSaveError,
}) {
  const save = useSaveCard('grammar')
  const showCheck = save.isPending || save.isSuccess

  const onSave = () =>
    save.mutate(
      {
        bookId,
        pattern,
        explanation,
        interpretationGuide: interpretation_guide, // service는 camelCase 인자
        exampleSentence,
        chapter,
      },
      { onError: onSaveError },
    )

  return (
    <article className="grammar-item">
      <button
        type="button"
        className="item-save"
        onClick={onSave}
        disabled={showCheck}
        aria-label={showCheck ? '저장됨' : '카드로 저장'}
      >
        {showCheck ? '✓' : '⊕'}
      </button>
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
