// 통계 — 글로벌 대시보드 (frontend_plan §6.6). 카드 기반 KPI + 서재 책별 진척.
// 세션 기반(읽은 시간·연속일·정답률)은 다음 단계 — 정직 표기로 보류 명시.
// 데이터는 useStats(→useLibrary/useCards)만 경유(불변규칙 2·3). 상태 UI는 §6.8.
import { useNavigate } from 'react-router-dom'
import { useStats } from './useStats'
import KpiCard from './KpiCard'
import './Stats.css'

export default function StatsDashboard() {
  const navigate = useNavigate()
  const { wordCount, grammarCount, books, isPending, isError, refetch } = useStats()

  if (isPending) return <DashSkeleton />
  if (isError)
    return (
      <main className="screen">
        <div className="state">
          <h2 className="state__title">통계를 불러오지 못했어요</h2>
          <p className="state__msg">연결이 잠깐 끊겼나 봐요. 다시 시도해 주세요.</p>
          <button type="button" className="btn-accent" onClick={refetch}>
            다시 시도
          </button>
        </div>
      </main>
    )

  // 빈 통계: 모은 카드 0 + 서재 진척 없음 → 다음 행동 1개(§6.8).
  const isEmpty = wordCount === 0 && grammarCount === 0 && books.length === 0
  if (isEmpty)
    return (
      <main className="screen">
        <div className="state">
          <h2 className="state__title">읽기 시작하면 쌓여요</h2>
          <p className="state__msg">책을 읽다가 ＋로 단어·문법을 담으면 여기 모여요.</p>
          <button type="button" className="btn-accent" onClick={() => navigate('/library')}>
            서재로
          </button>
        </div>
      </main>
    )

  return (
    <main className="screen stats">
      <h1 className="stats__title">통계</h1>

      <div className="kpi-row">
        <KpiCard label="모은 단어" value={wordCount} />
        <KpiCard label="모은 문법" value={grammarCount} />
      </div>

      {books.length > 0 && (
        <section className="stats-section">
          <h2 className="stats-section__title">책별 진척</h2>
          <div className="book-rows">
            {books.map((b) => (
              <button
                key={b.bookId}
                type="button"
                className="book-row"
                onClick={() => navigate(`/stats/${b.bookId}`)}
              >
                <span className="book-row__title">{b.title}</span>
                <span className="book-row__counts">
                  단어 {b.wordCount} · 문법 {b.grammarCount}
                </span>
                <span className="book-row__progress">
                  <span className="progress">
                    <span className="progress__fill" style={{ width: `${b.progressPct}%` }} />
                  </span>
                  <span className="book-row__pct">{b.progressPct}%</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="stats-soon">
        읽은 시간 · 연속일 · 정답률 통계는 다음 업데이트에서 추가돼요.
      </p>
    </main>
  )
}

// 로딩 스켈레톤 — KPI 2 + 책 행 몇 줄 (§6.8). .skeleton 전역 재사용.
function DashSkeleton() {
  return (
    <main className="screen stats">
      <h1 className="stats__title">통계</h1>
      <div className="kpi-row">
        <div className="skeleton kpi-skeleton" />
        <div className="skeleton kpi-skeleton" />
      </div>
      <div className="book-rows">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton book-row-skeleton" />
        ))}
      </div>
    </main>
  )
}
