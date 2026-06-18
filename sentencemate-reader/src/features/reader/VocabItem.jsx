import ThinkingCard from './ThinkingCard'
import { useSaveCard } from './useSaveCard'

// 단어 학습 단위 카드 (§6.2) — word(영어 제목) + meaning(한 줄 뜻) + thinking[] 기본 펼침.
// thinking은 비계(scaffolding)라 접지 않고 늘 보여 추론을 키운다(§6.2). 빈 배열이면 영역 생략.
// 우상단 ⊕: 단어+thinking 통째 1카드로 저장(M5). example_sentence·chapter는 클라가 첨부(불변규칙 5).
export default function VocabItem({
  word,
  meaning,
  thinking = [],
  bookId,
  exampleSentence,
  chapter = null,
  onSaveError,
}) {
  const save = useSaveCard('word')
  // 낙관적: 누르는 즉시 ✓(pending) → 성공 시 ✓ 유지. 실패 시 둘 다 false → ⊕로 롤백(§6.2).
  const showCheck = save.isPending || save.isSuccess

  const onSave = () =>
    save.mutate(
      { bookId, word, meaning, thinking, exampleSentence, chapter },
      { onError: onSaveError }, // 롤백은 mutation 상태로 자동 + 상위에 토스트 신호
    )

  return (
    <article className="vocab-item">
      <button
        type="button"
        className="item-save"
        onClick={onSave}
        disabled={showCheck}
        aria-label={showCheck ? '저장됨' : '카드로 저장'}
      >
        {showCheck ? '✓' : '⊕'}
      </button>
      <h4 className="vocab-item__word">{word}</h4>
      {meaning && <p className="vocab-item__meaning">{meaning}</p>}
      {thinking.length > 0 && (
        <div className="vocab-item__thinking">
          {thinking.map((t, i) => (
            <ThinkingCard key={i} type={t.type} title={t.title} body={t.body} />
          ))}
        </div>
      )}
    </article>
  )
}
