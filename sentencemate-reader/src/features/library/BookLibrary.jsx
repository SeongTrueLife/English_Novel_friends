// 서재 (frontend_plan §6.1) — 첫 실제 화면. useLibrary(→services/books) 통해서만 데이터 접근(불변규칙 2).
// 상태 UI(스켈레톤/빈/에러, §6.8)는 지금은 로컬 컴포넌트, 재사용 시 components/ui/로 승격(M4/M7).
import { useNavigate } from 'react-router-dom'
import { useLibrary } from './useLibrary'
import BookCover from './BookCover'
import './BookLibrary.css'

// progress_pct(0~100, null 가능)를 0~100 정수 %로.
function pctOf(row) {
  return Math.round(row.progress_pct ?? 0)
}

export default function BookLibrary() {
  const navigate = useNavigate()
  const { data: rows, isPending, isError, refetch } = useLibrary()

  // TODO: #4 AddBookSheet 오버레이 (다음 조각). 지금은 stub.
  const handleAddBook = () => {
    /* TODO: #4 AddBookSheet */
  }
  const openBook = (bookId) => navigate(`/read/${bookId}`)

  if (isPending) return <LibrarySkeleton />
  if (isError) return <LibraryError onRetry={refetch} />
  if (!rows || rows.length === 0) return <LibraryEmpty onAdd={handleAddBook} />

  // getLibrary가 last_opened DESC NULLS LAST → 첫 행이 가장 최근 연 책. 연 적 없으면(NULL) 숨김.
  const recent = rows[0]?.last_opened_at ? rows[0] : null

  return (
    <main className="screen library">
      <h1 className="library__title">서재</h1>

      {recent && <ContinueReading row={recent} onOpen={openBook} />}

      <section className="library__shelf">
        <h2 className="library__h2">내 서재</h2>
        <div className="book-grid">
          {rows.map((row) => (
            <BookGridItem key={row.book_id} row={row} onOpen={openBook} />
          ))}
          <AddBookTile onClick={handleAddBook} />
        </div>
      </section>
    </main>
  )
}

// ── 계속 읽기 (가장 최근 연 책 크게 + 진행률 + 이어 읽기) ──────────
function ContinueReading({ row, onOpen }) {
  const book = row.books ?? {}
  const pct = pctOf(row)
  return (
    <section className="continue">
      <BookCover
        title={book.title ?? '제목 없음'}
        author={book.author}
        size="lg"
      />
      <div className="continue__body">
        <span className="continue__label">계속 읽기</span>
        <h2 className="continue__title">{book.title ?? '제목 없음'}</h2>
        {book.author ? (
          <span className="continue__author">{book.author}</span>
        ) : null}
        <div className="continue__progress-row">
          <div className="progress">
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="continue__pct">{pct}%</span>
        </div>
        <button
          type="button"
          className="btn-accent"
          onClick={() => onOpen(row.book_id)}
        >
          이어 읽기
        </button>
      </div>
    </section>
  )
}

// ── 그리드 항목 (표지 탭 → 리더, 진행률 바 + %) ────────────────────
function BookGridItem({ row, onOpen }) {
  const book = row.books ?? {}
  const pct = pctOf(row)
  return (
    <button
      type="button"
      className="book-tile"
      onClick={() => onOpen(row.book_id)}
    >
      <BookCover title={book.title ?? '제목 없음'} author={book.author} />
      <div className="book-tile__meta">
        <div className="progress">
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="book-tile__pct">{pct}%</span>
      </div>
    </button>
  )
}

// ── 책 추가 타일 (점선) ──────────────────────────────────────────
function AddBookTile({ onClick }) {
  return (
    <button type="button" className="add-tile" onClick={onClick}>
      <span className="add-tile__plus" aria-hidden="true">
        ＋
      </span>
      책 추가
    </button>
  )
}

// ── 상태 UI (§6.8) ───────────────────────────────────────────────
function LibrarySkeleton() {
  return (
    <main className="screen library">
      <h1 className="library__title">서재</h1>
      <div className="book-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton--cover" />
        ))}
      </div>
    </main>
  )
}

function LibraryEmpty({ onAdd }) {
  return (
    <main className="screen library">
      <div className="state">
        <h2 className="state__title">아직 책이 없어요</h2>
        <p className="state__msg">
          첫 책을 추가하면 여기에서 읽기 시작할 수 있어요.
        </p>
        <button type="button" className="btn-accent" onClick={onAdd}>
          첫 책 추가
        </button>
      </div>
    </main>
  )
}

function LibraryError({ onRetry }) {
  return (
    <main className="screen library">
      <div className="state">
        <h2 className="state__title">서재를 불러오지 못했어요</h2>
        <p className="state__msg">연결이 잠깐 끊겼나 봐요. 다시 시도해 주세요.</p>
        <button type="button" className="btn-accent" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    </main>
  )
}
