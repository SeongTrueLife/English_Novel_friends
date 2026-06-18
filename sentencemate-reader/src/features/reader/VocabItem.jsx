import ThinkingCard from './ThinkingCard'

// 단어 학습 단위 카드 (§6.2) — word(영어 제목) + meaning(한 줄 뜻) + thinking[] 기본 펼침.
// thinking은 비계(scaffolding)라 접지 않고 늘 보여 추론을 키운다(§6.2). 빈 배열이면 영역 생략.
export default function VocabItem({ word, meaning, thinking = [] }) {
  return (
    <article className="vocab-item">
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
