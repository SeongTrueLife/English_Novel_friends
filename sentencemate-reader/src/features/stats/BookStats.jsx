// 통계 — 책별 상세 (frontend_plan §6.7). 요약(진행률·단어/문법 수·마지막 읽음) + 챕터별 카드 수.
// 카드 목록 재나열 금지 — 단어장으로 연결(중복 방지). 데이터는 useBookStats만 경유(불변규칙 2·3).
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBookStats } from './useStats'
import KpiCard from './KpiCard'
import './Stats.css'

// ISO 문자열 → YYYY-MM-DD. 없으면 '기록 없음'.
function fmtDate(iso) {
  if (!iso) return '기록 없음'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '기록 없음' : d.toISOString().slice(0, 10)
}

export default function BookStats() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const {
    title,
    author,
    progressPct,
    lastOpenedAt,
    wordCount,
    grammarCount,
    chapters,
    isPending,
    isError,
    refetch,
  } = useBookStats(bookId)

  if (isPending) return <BookSkeleton />
  if (isError)
    return (
      <main className="screen">
        <Link to="/stats" className="stats-back">← 통계로</Link>
        <div className="state">
          <h2 className="state__title">통계를 불러오지 못했어요</h2>
          <p className="state__msg">연결이 잠깐 끊겼나 봐요. 다시 시도해 주세요.</p>
          <button type="button" className="btn-accent" onClick={refetch}>
            다시 시도
          </button>
        </div>
      </main>
    )

  return (
    <main className="screen stats">
      <Link to="/stats" className="stats-back">← 통계로</Link>

      <header className="book-stats__head">
        <h1 className="stats__title">{title}</h1>
        {author && <p className="book-stats__author">{author}</p>}
      </header>

      {/* 요약 */}
      <div className="kpi-row">
        <KpiCard label="진행률" value={progressPct == null ? '—' : `${progressPct}%`} />
        <KpiCard label="모은 단어" value={wordCount} />
        <KpiCard label="모은 문법" value={grammarCount} />
      </div>
      {progressPct != null && (
        <span className="progress book-stats__bar">
          <span className="progress__fill" style={{ width: `${progressPct}%` }} />
        </span>
      )}
      <p className="book-stats__last">마지막 읽음 · {fmtDate(lastOpenedAt)}</p>

      {/* 챕터별 카드 수 */}
      <section className="stats-section">
        <h2 className="stats-section__title">챕터별 카드 수</h2>
        {chapters.length === 0 ? (
          <p className="state__msg book-stats__empty">아직 이 책에서 담은 카드가 없어요.</p>
        ) : (
          <div className="chapter-rows">
            {chapters.map((ch) => (
              <div key={ch.name} className="chapter-row">
                <span className="chapter-row__name">{ch.name}</span>
                <span className="chapter-row__sub">
                  단어 {ch.wordCount} · 문법 {ch.grammarCount}
                </span>
                <span className="chapter-row__total">{ch.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 액션 — 단어장으로 연결(카드 목록 재나열 금지) */}
      <div className="book-stats__actions">
        <button
          type="button"
          className="btn-accent"
          onClick={() => navigate('/vocab?tab=word')}
        >
          단어장 보기
        </button>
        <button
          type="button"
          className="book-stats__study"
          onClick={() => navigate('/vocab/study?kind=word')}
        >
          학습 시작
        </button>
      </div>
    </main>
  )
}

function BookSkeleton() {
  return (
    <main className="screen stats">
      <Link to="/stats" className="stats-back">← 통계로</Link>
      <div className="skeleton book-title-skeleton" />
      <div className="kpi-row">
        <div className="skeleton kpi-skeleton" />
        <div className="skeleton kpi-skeleton" />
        <div className="skeleton kpi-skeleton" />
      </div>
      <div className="chapter-rows">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton chapter-row-skeleton" />
        ))}
      </div>
    </main>
  )
}
