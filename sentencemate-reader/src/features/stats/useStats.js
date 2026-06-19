// 통계 파생 훅 (frontend_plan §6.6/§6.7) — 카드 기반 통계만(MVP). 세션 기반은 다음 단계.
// 새 service/쿼리 없이 기존 캐시 3개를 합성(불변규칙 2·3): useLibrary + useCards('word')·('grammar').
// useCards의 두 키는 VocabList/FlashcardStudy가 데우는 캐시와 동일 → 중복 요청 없이 공유.
import { useMemo } from 'react'
import { useLibrary } from '../library/useLibrary'
import { useCards } from '../vocab/useCards'

const NO_CHAPTER = '챕터 미상' // null/빈 chapter 버킷 (맨 뒤로 정렬)

// 세 쿼리 합성 + 로딩/에러 병합. 두 통계 훅의 공용 토대.
function useStatsSources() {
  const library = useLibrary()
  const words = useCards('word')
  const grammar = useCards('grammar')
  return {
    library,
    words,
    grammar,
    isPending: library.isPending || words.isPending || grammar.isPending,
    isError: library.isError || words.isError || grammar.isError,
    refetch: () => {
      library.refetch()
      words.refetch()
      grammar.refetch()
    },
  }
}

// book_id → 개수 맵. (단어/문법 각각)
function countByBook(cards) {
  const m = new Map()
  for (const c of cards ?? []) m.set(c.book_id, (m.get(c.book_id) ?? 0) + 1)
  return m
}

// 글로벌 대시보드용. KPI(전체 카드 수) + 서재 책별 진척 행.
export function useStats() {
  const { library, words, grammar, isPending, isError, refetch } = useStatsSources()

  const data = useMemo(() => {
    const wordCount = words.data?.length ?? 0
    const grammarCount = grammar.data?.length ?? 0
    const wordByBook = countByBook(words.data)
    const grammarByBook = countByBook(grammar.data)

    // 서재 순서(최근 연 순, getLibrary가 정렬) 유지. 카드는 책에 매여 서재에서 빼도 보존(결정 7) →
    // 서재에 없는 책 카드는 KPI엔 잡히되 행엔 안 뜸(KPI=전체, 행=서재 책).
    const books = (library.data ?? []).map((row) => ({
      bookId: row.book_id,
      title: row.books?.title ?? '제목 없음',
      wordCount: wordByBook.get(row.book_id) ?? 0,
      grammarCount: grammarByBook.get(row.book_id) ?? 0,
      progressPct: Math.round(row.progress_pct ?? 0),
      lastOpenedAt: row.last_opened_at ?? null,
    }))

    return { wordCount, grammarCount, books }
  }, [library.data, words.data, grammar.data])

  return { ...data, isPending, isError, refetch }
}

// 책별 상세용. 이 책 카드만 필터해 요약·챕터별 집계.
export function useBookStats(bookId) {
  const { library, words, grammar, isPending, isError, refetch } = useStatsSources()

  const data = useMemo(() => {
    const bookWords = (words.data ?? []).filter((c) => c.book_id === bookId)
    const bookGrammar = (grammar.data ?? []).filter((c) => c.book_id === bookId)
    const allCards = [...bookWords, ...bookGrammar]

    // 제목/저자: 서재 행 우선, 없으면 카드 조인(books)에서 폴백.
    const libRow = (library.data ?? []).find((r) => r.book_id === bookId)
    const fromCard = allCards.find((c) => c.books)?.books
    const title = libRow?.books?.title ?? fromCard?.title ?? '제목 없음'
    const author = libRow?.books?.author ?? fromCard?.author ?? null

    // 챕터별 단어/문법 카운트. null/빈값 → '챕터 미상' 버킷, 맨 뒤.
    const m = new Map()
    const bump = (name, key) => {
      const k = name || NO_CHAPTER
      if (!m.has(k)) m.set(k, { name: k, wordCount: 0, grammarCount: 0, total: 0 })
      const e = m.get(k)
      e[key] += 1
      e.total += 1
    }
    for (const c of bookWords) bump(c.chapter, 'wordCount')
    for (const c of bookGrammar) bump(c.chapter, 'grammarCount')
    const chapters = [...m.values()].sort((a, b) => {
      if (a.name === NO_CHAPTER) return 1
      if (b.name === NO_CHAPTER) return -1
      return 0 // 첫 등장 순서 보존(Map 삽입 순서)
    })

    return {
      title,
      author,
      progressPct: libRow ? Math.round(libRow.progress_pct ?? 0) : null,
      lastOpenedAt: libRow?.last_opened_at ?? null,
      wordCount: bookWords.length,
      grammarCount: bookGrammar.length,
      chapters,
    }
  }, [library.data, words.data, grammar.data, bookId])

  return { ...data, isPending, isError, refetch }
}
