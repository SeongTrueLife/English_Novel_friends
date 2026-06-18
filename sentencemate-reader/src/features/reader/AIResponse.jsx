// AI 풀이 표면 (frontend_plan §6.2) — 세로=바텀시트 / 가로=사이드패널, 3구역.
// 중앙: 대화 스레드(turn1 4축 응답 + follow-up 질문·응답 누적, 채팅처럼). 빈 슬롯 섹션째 숨김.
// 본문 위 '막는' 모달이 아니라 '도킹된 패널'(backdrop 없음) — 원문↔풀이 대조를 위해 책이 계속 보이고 조작 가능(§6.2). 닫기는 ✕.
// 하단 고정: 자연 해석 토글(turn1만) + "더 물어보기" 입력. 둘 다 스크롤 밖이라 누적돼도 위치 불변.
// 멀티턴 응답은 휘발성(DB 미저장). 카드 저장 ⊕은 M5(모든 턴에서 동작).
import VocabItem from './VocabItem'
import GrammarItem from './GrammarItem'
import ThinkingCard from './ThinkingCard'
import NaturalTranslation from './NaturalTranslation'
import FollowUp from './FollowUp'
import './AIResponse.css'

// 에러 코드 → 사람 말투 메시지 + 재시도 여부 (§6.8, 사용자 탓 금지).
const ERROR_MAP = {
  quota_exceeded: {
    text: '오늘 AI 사용량을 다 썼어요 · 내일 채워져요 (읽기·복습은 계속 가능해요)',
    retry: false,
  },
  ai_failed: { text: '연결이 잠깐 끊겼어요 · 다시 시도해 주세요', retry: true },
  network: { text: '연결이 잠깐 끊겼어요 · 다시 시도해 주세요', retry: true },
  unauthorized: {
    text: '세션을 다시 준비 중이에요 · 잠시 후 다시 시도해 주세요',
    retry: true,
  },
  unknown: { text: '문제가 생겼어요 · 다시 시도해 주세요', retry: true },
}

export default function AIResponse({
  sentence,
  chapter,
  bookId,
  messages,
  isPending,
  isError,
  error,
  onRetry,
  onClose,
  onFollowUp,
  onSaveError,
}) {
  // 자연 해석은 turn-1 응답 것만(follow-up마다 같은 문장 재번역은 노이즈 → 무시).
  const firstAnswer = messages.find((m) => m.role === 'model')?.answer
  const hasAnswer = messages.some((m) => m.role === 'model')

  return (
    <aside
      className="airesponse"
      role="dialog"
      aria-label="AI 풀이"
      aria-busy={isPending}
    >
      {/* 상단 고정 — 선택 문장 앵커(스크롤에 안 쓸림) */}
      <header className="airesponse__anchor">
        <p className="airesponse__sentence">{sentence}</p>
        <button
          type="button"
          className="airesponse__close"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>
      </header>

      {/* 중앙 스크롤 — 대화 스레드 + 끝에 진행/에러 상태 */}
      <div className="airesponse__body">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            m.display && (
              <p key={i} className="airesponse__question">
                {m.display}
              </p>
            )
          ) : (
            <ResponseBody
              key={i}
              data={m.answer}
              bookId={bookId}
              exampleSentence={sentence}
              chapter={chapter}
              onSaveError={onSaveError}
            />
          ),
        )}

        {isPending && <LoadingSkeleton />}
        {!isPending && isError && (
          <ErrorView code={error?.code} onRetry={onRetry} />
        )}
      </div>

      {/* 하단 고정 — 자연 해석 토글(turn1) + 더 물어보기 입력. 둘 다 채팅 스크롤 밖. */}
      {hasAnswer && (
        <footer className="airesponse__foot">
          {firstAnswer?.naturalTranslation && (
            <NaturalTranslation text={firstAnswer.naturalTranslation} />
          )}
          <FollowUp onSend={onFollowUp} disabled={isPending} />
        </footer>
      )}
    </aside>
  )
}

// v3 JSON → 4축 구조화 (§6.2 슬롯→UI). 빈 배열 섹션은 통째로 숨김.
// 저장 배선: bookId·exampleSentence(=앵커 원문, 불변규칙 5)·chapter(ask 시점 현재 챕터)·onSaveError를
// 학습 항목에 내려보낸다. chapter는 TOC 매칭 실패 시 null(nullable라 OK).
function ResponseBody({ data, bookId, exampleSentence, chapter, onSaveError }) {
  const vocab = data.vocab ?? []
  const grammar = data.grammar ?? []
  const sentenceThinking = data.sentence_thinking ?? []

  return (
    <div className="airesponse__turn">
      {vocab.length > 0 && (
        <section className="airesponse__section">
          <h3 className="airesponse__section-title">단어</h3>
          {vocab.map((v, i) => (
            <VocabItem
              key={i}
              word={v.word}
              meaning={v.meaning}
              thinking={v.thinking}
              bookId={bookId}
              exampleSentence={exampleSentence}
              chapter={chapter}
              onSaveError={onSaveError}
            />
          ))}
        </section>
      )}

      {grammar.length > 0 && (
        <section className="airesponse__section">
          <h3 className="airesponse__section-title">문법</h3>
          {grammar.map((g, i) => (
            <GrammarItem
              key={i}
              pattern={g.pattern}
              explanation={g.explanation}
              interpretation_guide={g.interpretation_guide}
              bookId={bookId}
              exampleSentence={exampleSentence}
              chapter={chapter}
              onSaveError={onSaveError}
            />
          ))}
        </section>
      )}

      {sentenceThinking.length > 0 && (
        <section className="airesponse__section">
          <h3 className="airesponse__section-title">문장 전체</h3>
          {sentenceThinking.map((t, i) => (
            <ThinkingCard key={i} type={t.type} title={t.title} body={t.body} />
          ))}
        </section>
      )}
    </div>
  )
}

// 빈 스피너 대신 카드 골격 스켈레톤 + "풀어보는 중"(§6.8 — 멈춤 오해 방지).
function LoadingSkeleton() {
  return (
    <div className="airesponse__loading">
      <span className="airesponse__loading-label">풀어보는 중…</span>
      <div className="airesponse__skeleton" />
      <div className="airesponse__skeleton" />
      <div className="airesponse__skeleton" />
    </div>
  )
}

function ErrorView({ code, onRetry }) {
  const { text, retry } = ERROR_MAP[code] ?? ERROR_MAP.unknown
  return (
    <div className="airesponse__error">
      <p className="airesponse__error-text">{text}</p>
      {retry && (
        <button type="button" className="airesponse__retry" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
