// 단어장 (frontend_plan §6.3) — 저장한 카드를 단어/문법 탭 · 책별 그룹으로 보는 보관함.
// 데이터 접근은 useCards/useDeleteCard(→services/cards)만 경유(불변규칙 2·3). 상태 UI는 §6.8.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCards, useDeleteCard } from './useCards'
import { useSession } from '../../stores/useSession'
import { useAccountSheet } from '../../stores/useAccountSheet'
import ThinkingCard from '../reader/ThinkingCard'
import Markdown from '../reader/Markdown'
import './VocabList.css'

export default function VocabList() {
  // 탭 상태는 URL(?tab=word|grammar)에 둔다 — 뒤로가기/공유/새로고침에 견딤. 이상값이면 word 기본.
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'grammar' ? 'grammar' : 'word'
  const setTab = (t) => setParams(t === 'word' ? {} : { tab: t }, { replace: true })

  const navigate = useNavigate()
  const { data: rows, isPending, isError, refetch } = useCards(tab)
  // 학습 모드로 현재 탭 kind 전달(§6.3↔6.4). 카드 없으면 비활성(빈 학습 진입 차단).
  const hasCards = rows && rows.length > 0

  // 선택 모드(§6.3 다중 체크 → 선택 학습/삭제). selectedIds는 현재 탭 카드 한정.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const bulkDel = useDeleteCard()

  const clearSelection = () => setSelectedIds(new Set())
  const exitSelect = () => {
    setSelectMode(false)
    clearSelection()
  }
  // 탭 바꾸면 선택 초기화(kind 섞임 방지) — setTab을 감싼다.
  const onTab = (t) => {
    clearSelection()
    setTab(t)
  }
  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectedCount = selectedIds.size
  const studySelected = () =>
    navigate(`/vocab/study?kind=${tab}`, { state: { ids: [...selectedIds] } })
  const deleteSelected = async () => {
    const ids = [...selectedIds]
    const results = await Promise.allSettled(ids.map((id) => bulkDel.mutateAsync(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) console.error(`카드 삭제 ${failed}건 실패`)
    exitSelect() // 무효화(useDeleteCard onSuccess)로 목록 자동 갱신
  }

  let body
  if (isPending) {
    body = <ListSkeleton />
  } else if (isError) {
    body = <ListError onRetry={refetch} />
  } else if (!rows || rows.length === 0) {
    body = <ListEmpty tab={tab} />
  } else {
    body = groupByBook(rows).map((g) => (
      <section key={g.bookId} className="vocab-group">
        <header className="vocab-group__head">
          <h2 className="vocab-group__title">{g.title}</h2>
          <span className="vocab-group__count">{g.rows.length}</span>
        </header>
        {g.rows.map((row) => (
          <CardRow
            key={row.card_id}
            row={row}
            tab={tab}
            selectMode={selectMode}
            selected={selectedIds.has(row.card_id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </section>
    ))
  }

  return (
    <main className={selectMode ? 'screen vocab vocab--selecting' : 'screen vocab'}>
      <div className="vocab__head">
        <h1 className="vocab__title">단어장</h1>
        <div className="vocab__head-actions">
          {!selectMode && (
            <button
              type="button"
              className="vocab__study-btn"
              onClick={() => navigate(`/vocab/study?kind=${tab}`)}
              disabled={!hasCards}
            >
              학습 시작
            </button>
          )}
          <button
            type="button"
            className="vocab__select-btn"
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            disabled={!selectMode && !hasCards}
          >
            {selectMode ? '취소' : '선택'}
          </button>
        </div>
      </div>
      <VocabTabs tab={tab} onTab={onTab} />
      {!selectMode && <LinkHint />}
      {body}

      {selectMode && (
        <div className="vocab-actionbar">
          <button
            type="button"
            className="vocab-actionbar__btn"
            onClick={studySelected}
            disabled={selectedCount === 0}
          >
            {selectedCount}개 학습
          </button>
          <button
            type="button"
            className="vocab-actionbar__btn vocab-actionbar__btn--danger"
            onClick={deleteSelected}
            disabled={selectedCount === 0 || bulkDel.isPending}
          >
            {selectedCount}개 삭제
          </button>
        </div>
      )}
    </main>
  )
}

// 소프트 힌트(§6.9) — 미연동일 때만, 닫기 가능(localStorage). 연동되면 자동 숨김.
// 클릭 시 계정 시트를 연다(같은 시트를 AppShell 계정 아이콘도 연다 — useAccountSheet).
const HINT_KEY = 'linkHintDismissed'

function LinkHint() {
  const isLinked = useSession((s) => !!s.user?.email)
  const openSheet = useAccountSheet((s) => s.openSheet)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(HINT_KEY) === 'true',
  )

  if (isLinked || dismissed) return null

  const dismiss = (e) => {
    e.stopPropagation()
    localStorage.setItem(HINT_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="link-hint" role="button" tabIndex={0} onClick={openSheet}>
      <span className="link-hint__text">
        이메일 연동하면 다른 기기에서도 단어장을 써요 →
      </span>
      <button
        type="button"
        className="link-hint__close"
        onClick={dismiss}
        aria-label="힌트 닫기"
      >
        ✕
      </button>
    </div>
  )
}

// 단어/문법 탭바
function VocabTabs({ tab, onTab }) {
  return (
    <div className="vocab-tabs" role="tablist">
      {[
        ['word', '단어'],
        ['grammar', '문법'],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          className={tab === key ? 'vocab-tab vocab-tab--active' : 'vocab-tab'}
          onClick={() => onTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// 카드 한 줄 — 접힘(스캔)/펼침(원문 예문 + 상세) 로컬 토글 + 삭제/선택(§6.3).
function CardRow({ row, tab, selectMode, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false)
  const del = useDeleteCard()
  const isWord = tab === 'word'

  const title = isWord ? row.word : row.pattern
  const sub = isWord ? row.meaning : row.interpretation_guide

  return (
    <article className="card-row">
      <div className="card-row__main">
        {selectMode && (
          <input
            type="checkbox"
            className="card-row__check"
            checked={selected}
            onChange={() => onToggleSelect(row.card_id)}
            aria-label="카드 선택"
          />
        )}

        <button
          type="button"
          className="card-row__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="card-row__chevron" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <span className="card-row__text">
            <span className="card-row__term">{title}</span>
            {sub && <span className="card-row__sub">{sub}</span>}
          </span>
        </button>

        {row.chapter && <span className="card-row__chapter">{row.chapter}</span>}

        {!selectMode && (
          <button
            type="button"
            className="card-row__delete"
            onClick={() => del.mutate(row.card_id)}
            disabled={del.isPending}
            aria-label="카드 삭제"
          >
            ×
          </button>
        )}
      </div>

      {expanded && (
        <div className="card-row__detail">
          <p className="card-row__example">{row.example_sentence}</p>
          {isWord
            ? (row.thinking ?? []).map((t, i) => (
                <ThinkingCard key={i} type={t.type} title={t.title} body={t.body} />
              ))
            : row.explanation && (
                <p className="card-row__explanation">
                  <Markdown text={row.explanation} />
                </p>
              )}
        </div>
      )}
    </article>
  )
}

// rows(created_at desc)를 첫 등장 순서 보존하며 책별로 그룹.
function groupByBook(rows) {
  const m = new Map()
  for (const r of rows) {
    if (!m.has(r.book_id)) {
      m.set(r.book_id, {
        bookId: r.book_id,
        title: r.books?.title ?? '제목 없음',
        rows: [],
      })
    }
    m.get(r.book_id).rows.push(r)
  }
  return [...m.values()]
}

// ── 상태 UI (§6.8) ───────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="vocab-skeletons">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton vocab-skeleton-row" />
      ))}
    </div>
  )
}

function ListEmpty({ tab }) {
  return (
    <div className="state">
      <h2 className="state__title">
        {tab === 'word' ? '아직 담은 단어가 없어요' : '아직 담은 문법이 없어요'}
      </h2>
      <p className="state__msg">읽다가 ＋로 담아보세요.</p>
    </div>
  )
}

function ListError({ onRetry }) {
  return (
    <div className="state">
      <h2 className="state__title">단어장을 불러오지 못했어요</h2>
      <p className="state__msg">연결이 잠깐 끊겼나 봐요. 다시 시도해 주세요.</p>
      <button type="button" className="btn-accent" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  )
}
