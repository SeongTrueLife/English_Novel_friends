// AI 풀이 표면 (frontend_plan §6.2) — 세로=바텀시트 / 가로=사이드패널, 3구역.
// 이번 슬라이스는 골격: 중앙은 로딩 스켈레톤·에러·raw JSON까지. 4축 구조화 렌더는 sub-#3.
// 본문 위 '막는' 모달이 아니라 '도킹된 패널'(backdrop 없음) — 원문↔풀이 대조를 위해 책이 계속 보이고 조작 가능(§6.2). 닫기는 ✕.
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

export default function AIResponse({ sentence, mutation, onRetry, onClose }) {
  const { isPending, isError, error, data } = mutation

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

      {/* 중앙 스크롤 — 상태별 */}
      <div className="airesponse__body">
        {isPending && <LoadingSkeleton />}
        {isError && <ErrorView code={error?.code} onRetry={onRetry} />}
        {!isPending && !isError && data && (
          // 골격: 검증용 raw 표시. sub-#3에서 vocab/grammar/thinking/naturalTranslation 렌더로 교체.
          <pre className="airesponse__raw">{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>

      {/* 하단 고정 — 자리만(자연해석 토글·follow-up 입력은 sub-#3/M6) */}
      <footer className="airesponse__foot">
        <div className="airesponse__followup-stub" aria-hidden="true">
          더 물어보기 (다음 단계)
        </div>
      </footer>
    </aside>
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
