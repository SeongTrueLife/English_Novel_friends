import { useMemo, useState } from 'react'

// 학습 범위 프리셋 선택 (frontend_plan §6.4) — /vocab/study 진입 첫 단계.
// 공용 Sheet UI가 아직 없어 모달 대신 화면 본문 '패널'로 렌더(파일명은 arch ③ feature 맵과 일치 유지).
// 데이터는 상위가 useCards로 받은 cards 배열만 받아 개수/챕터를 파생(불변규칙 2·3 — 새 쿼리 X).
const RECENT_N = 20 // '최근 N' 기본값. 카드가 적으면 length로 클램프.

export default function StudyScopeSheet({ cards = [], kind, onKind, onStart }) {
  const [preset, setPreset] = useState('all')
  const [chapter, setChapter] = useState(null) // preset==='chapter'일 때만 의미
  const [shuffle, setShuffle] = useState(false)

  // 프리셋별 개수 + 챕터 칩 — cards에서 파생(서버 재요청 없음).
  const { total, unreviewedCount, chapters } = useMemo(() => {
    const m = new Map()
    let unreviewed = 0
    for (const c of cards) {
      if (!c.last_reviewed_at || c.review_count === 0) unreviewed += 1
      if (c.chapter) m.set(c.chapter, (m.get(c.chapter) ?? 0) + 1)
    }
    return {
      total: cards.length,
      unreviewedCount: unreviewed,
      chapters: [...m.entries()].map(([name, count]) => ({ name, count })),
    }
  }, [cards])

  // 현재 선택의 결과 카드 수 — 0이면 '학습 시작' 비활성.
  const resultCount =
    preset === 'all'
      ? total
      : preset === 'recent'
        ? Math.min(RECENT_N, total)
        : preset === 'unreviewed'
          ? unreviewedCount
          : chapter
            ? (chapters.find((c) => c.name === chapter)?.count ?? 0)
            : 0

  const start = () =>
    onStart({
      preset,
      chapter: preset === 'chapter' ? chapter : undefined,
      recentN: preset === 'recent' ? RECENT_N : undefined,
      shuffle,
    })

  return (
    <div className="study-scope">
      <h1 className="study-scope__title">학습 시작</h1>

      {/* kind 토글 (단어/문법 세션 분리) — VocabTabs 룩 재사용 */}
      <div className="vocab-tabs" role="tablist" aria-label="학습 종류">
        {[
          ['word', '단어'],
          ['grammar', '문법'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={kind === key}
            className={kind === key ? 'vocab-tab vocab-tab--active' : 'vocab-tab'}
            onClick={() => onKind(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 범위 프리셋 */}
      <div className="scope-presets" role="radiogroup" aria-label="학습 범위">
        <PresetRow
          active={preset === 'all'}
          onSelect={() => setPreset('all')}
          label="전체"
          count={total}
        />
        <PresetRow
          active={preset === 'recent'}
          onSelect={() => setPreset('recent')}
          label={`최근 ${RECENT_N}개`}
          count={Math.min(RECENT_N, total)}
        />
        <PresetRow
          active={preset === 'unreviewed'}
          onSelect={() => setPreset('unreviewed')}
          label="아직 안 외운 것"
          count={unreviewedCount}
        />
        <PresetRow
          active={preset === 'chapter'}
          onSelect={() => setPreset('chapter')}
          label="챕터별"
          count={chapters.length === 0 ? 0 : undefined}
          disabled={chapters.length === 0}
        />

        {preset === 'chapter' && chapters.length > 0 && (
          <div className="scope-chips">
            {chapters.map((ch) => (
              <button
                key={ch.name}
                type="button"
                className={
                  chapter === ch.name ? 'scope-chip scope-chip--active' : 'scope-chip'
                }
                aria-pressed={chapter === ch.name}
                onClick={() => setChapter(ch.name)}
              >
                {ch.name}
                <span className="scope-chip__count">{ch.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 섞기 토글 */}
      <label className="scope-shuffle">
        <input
          type="checkbox"
          checked={shuffle}
          onChange={(e) => setShuffle(e.target.checked)}
        />
        섞기
      </label>

      <button
        type="button"
        className="btn-accent scope-start"
        onClick={start}
        disabled={resultCount === 0}
      >
        {resultCount === 0 ? '카드가 없어요' : `${resultCount}개 학습 시작`}
      </button>
    </div>
  )
}

// 프리셋 한 줄 — 라디오처럼 단일 선택. count undefined면 뱃지 생략.
function PresetRow({ active, onSelect, label, count, disabled = false }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={active ? 'scope-preset scope-preset--active' : 'scope-preset'}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="scope-preset__label">{label}</span>
      {count !== undefined && <span className="scope-preset__count">{count}</span>}
    </button>
  )
}
