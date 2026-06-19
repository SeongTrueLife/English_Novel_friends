// 플래시카드 학습 모드 (frontend_plan §6.4) — 범위 선택 → 카드 덱(뒤집기·이전/다음·섞기·진행바).
// SRS(간격계산·정답평가)는 범위 밖(frontend_arch ⑥ M7) — 이 화면은 그 복습 UI의 '그릇'까지만.
// 데이터는 useCards(→services/cards)만 경유(불변규칙 2). 덱은 query 캐시에서 useMemo로 파생(규칙 3).
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useCards } from './useCards'
import StudyScopeSheet from './StudyScopeSheet'
import ThinkingCard from '../reader/ThinkingCard'
import Markdown from '../reader/Markdown'
import './FlashcardStudy.css'

export default function FlashcardStudy() {
  // kind는 URL(?kind=word|grammar)에 둔다 — VocabList 진입·새로고침에 견딤. 이상값이면 word.
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') === 'grammar' ? 'grammar' : 'word'
  const setKind = (k) => {
    setScope(null) // 종류 바꾸면 다시 범위부터
    setParams(k === 'word' ? {} : { kind: k }, { replace: true })
  }

  const { data: cards, isPending, isError, refetch } = useCards(kind)

  // 단어장 '선택 학습'으로 넘어오면 location.state.ids로 범위 시트를 건너뛰고 그 카드들만 덱 구성(§6.3).
  const location = useLocation()

  // scope=null → 범위 선택 단계 / 객체 → 덱 단계. shuffleNonce++ 로 재셔플 트리거.
  // ids로 진입했으면 'ids' 범위로 초기화(시트 스킵). useState 초기화는 1회만 — 이후 '범위 바꾸기'로 일반 흐름.
  const [scope, setScope] = useState(() => {
    const ids = location.state?.ids
    return ids && ids.length ? { preset: 'ids', ids, shuffle: false } : null
  })
  const [shuffleNonce, setShuffleNonce] = useState(0)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  // 덱 = 캐시(cards)에서 범위 필터·슬라이스·셔플로 파생. nonce는 재셔플 강제용(값 자체는 안 씀).
  const deck = useMemo(
    () => buildDeck(cards, scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, scope, shuffleNonce],
  )

  const startScope = (s) => {
    setScope(s)
    setIndex(0)
    setFlipped(false)
  }
  const reshuffle = () => {
    setScope((s) => (s ? { ...s, shuffle: true } : s))
    setShuffleNonce((n) => n + 1)
    setIndex(0)
    setFlipped(false)
  }
  const go = (delta) => {
    setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length - 1))
    setFlipped(false)
  }

  // ── 상태 분기 (§6.8) ──
  if (isPending) return <StudyScreen><DeckSkeleton /></StudyScreen>
  if (isError)
    return (
      <StudyScreen>
        <div className="state">
          <h2 className="state__title">카드를 불러오지 못했어요</h2>
          <p className="state__msg">연결이 잠깐 끊겼나 봐요. 다시 시도해 주세요.</p>
          <button type="button" className="btn-accent" onClick={refetch}>
            다시 시도
          </button>
        </div>
      </StudyScreen>
    )
  if (!cards || cards.length === 0)
    return (
      <StudyScreen>
        <div className="state">
          <h2 className="state__title">
            {kind === 'word' ? '아직 담은 단어가 없어요' : '아직 담은 문법이 없어요'}
          </h2>
          <p className="state__msg">읽다가 ＋로 담아보세요.</p>
          <Link to="/vocab" className="btn-accent">
            단어장으로
          </Link>
        </div>
      </StudyScreen>
    )

  // 범위 선택 단계
  if (!scope)
    return (
      <StudyScreen>
        <StudyScopeSheet cards={cards} kind={kind} onKind={setKind} onStart={startScope} />
      </StudyScreen>
    )

  // 범위는 골랐는데 결과 0 (예: '안 외운 것'이 0)
  if (deck.length === 0)
    return (
      <StudyScreen>
        <div className="state">
          <h2 className="state__title">이 범위엔 카드가 없어요</h2>
          <p className="state__msg">다른 범위를 골라보세요.</p>
          <button type="button" className="btn-accent" onClick={() => setScope(null)}>
            범위 다시 고르기
          </button>
        </div>
      </StudyScreen>
    )

  const safeIndex = Math.min(index, deck.length - 1)
  const card = deck[safeIndex]

  return (
    <StudyScreen>
      <div className="study-deck">
        <div className="study-deck__top">
          <button
            type="button"
            className="study-deck__scope"
            onClick={() => setScope(null)}
          >
            ← 범위 바꾸기
          </button>
          <button type="button" className="study-deck__shuffle" onClick={reshuffle}>
            섞기
          </button>
        </div>

        <Flashcard card={card} kind={kind} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />

        <div className="study-progress" aria-hidden="true">
          <div
            className="study-progress__bar"
            style={{ width: `${((safeIndex + 1) / deck.length) * 100}%` }}
          />
        </div>

        <div className="study-controls">
          <button
            type="button"
            className="study-nav"
            onClick={() => go(-1)}
            disabled={safeIndex <= 0}
          >
            이전
          </button>
          <span className="study-counter">
            {safeIndex + 1} / {deck.length}
          </span>
          <button
            type="button"
            className="study-nav"
            onClick={() => go(1)}
            disabled={safeIndex >= deck.length - 1}
          >
            다음
          </button>
        </div>
      </div>
    </StudyScreen>
  )
}

// 플래시카드 한 장 — 탭하면 앞↔뒤. (CSS 3D 플립 대신 면 전환 렌더로 단순/접근성 우선.)
function Flashcard({ card, kind, flipped, onFlip }) {
  const isWord = kind === 'word'
  return (
    <button
      type="button"
      className="flash-card"
      onClick={onFlip}
      aria-label={flipped ? '앞면 보기' : '뒤집어 뜻 보기'}
    >
      {!flipped ? (
        <div className="flash-card__face">
          <h2 className="flash-card__term">{isWord ? card.word : card.pattern}</h2>
          <p className="flash-card__example">
            {isWord
              ? underlineWord(card.example_sentence, card.word)
              : card.example_sentence}
          </p>
        </div>
      ) : (
        <div className="flash-card__face flash-card__face--back">
          {isWord ? (
            <>
              {card.meaning && <p className="flash-card__meaning">{card.meaning}</p>}
              {(card.thinking ?? []).map((t, i) => (
                <ThinkingCard key={i} type={t.type} title={t.title} body={t.body} />
              ))}
            </>
          ) : (
            <>
              {card.explanation && (
                <p className="flash-card__explanation">
                  <Markdown text={card.explanation} />
                </p>
              )}
              {card.interpretation_guide && (
                <p className="flash-card__guide">
                  <span className="flash-card__arrow" aria-hidden="true">
                    →
                  </span>
                  <span>
                    <Markdown text={card.interpretation_guide} />
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      )}
      <span className="flash-card__hint">{flipped ? '탭 → 앞면' : '탭 → 뜻'}</span>
    </button>
  )
}

// 범위에 맞게 캐시(cards)에서 덱을 파생. 셔플은 복사본 Fisher–Yates(원본 캐시 불변).
function buildDeck(cards, scope) {
  if (!cards || !scope) return []
  let list
  switch (scope.preset) {
    case 'ids':
      list = cards.filter((c) => scope.ids.includes(c.card_id)) // 단어장 선택 학습
      break
    case 'chapter':
      list = cards.filter((c) => c.chapter === scope.chapter)
      break
    case 'recent':
      list = cards.slice(0, scope.recentN) // getCards가 created_at desc → 앞이 최근
      break
    case 'unreviewed':
      list = cards.filter((c) => !c.last_reviewed_at || c.review_count === 0)
      break
    default:
      list = cards
  }
  if (scope.shuffle) {
    list = [...list]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
  }
  return list
}

// 예문 속 단어를 밑줄 강조(§6.4) — 대소문자 무시 첫 매칭만 wrap. 못 찾으면 문장 그대로(방어).
function underlineWord(sentence, word) {
  if (!sentence) return null
  if (!word) return sentence
  const i = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (i === -1) return sentence
  return (
    <>
      {sentence.slice(0, i)}
      <u className="flash-card__underline">{sentence.slice(i, i + word.length)}</u>
      {sentence.slice(i + word.length)}
    </>
  )
}

// 화면 껍데기 — .screen 전역 재사용. AppShell 탭바는 /vocab/study에서 보임.
function StudyScreen({ children }) {
  return <main className="screen study">{children}</main>
}

function DeckSkeleton() {
  return (
    <div className="study-deck">
      <div className="skeleton flash-card-skeleton" />
    </div>
  )
}
