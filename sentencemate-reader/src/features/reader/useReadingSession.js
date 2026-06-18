import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateProgress } from '../../services/books'
import { startSession, touchSession, endSession } from '../../services/sessions'

// 읽기 진척 저장 + reading_sessions 수명주기 (M6 #2, db_schema 결정 6).
// rendition의 'relocated'(쪽넘김)를 단일 트리거로:
//   · 진척(user_books)은 sessionId와 무관하게 항상 저장 — 세션 INSERT 중에도 안 샘.
//   · 첫 relocated(초기 display 포함)를 세션 시작점으로 startSession, 이후 relocated는 touchSession.
// best-effort 마감: pagehide/언마운트=endSession, visibilitychange(hidden)=touchSession(부활 버그 회피).
//   최종 안전망은 startSession 안의 '이전 미종료 세션 자동 마감'(A+C).
// progress_pct: epubjs locations.generate는 (전 섹션 강제 로드라) 느리고 깨진 섹션에 전체가 터지며
//   작은 책엔 total=0 함정(percentageFromCfi가 0 반환)까지 있어 진행률 토대로 부적합. 대신 relocated의
//   spine 위치(start.index + 섹션 내 displayed.page/total)로 근사 — 동기·예외 없음·전 섹션 로드 안 함.
export function useReadingSession(rendition, bookId) {
  const queryClient = useQueryClient()

  // 세션·위치 상태는 ref로(이벤트 핸들러가 effect 재실행 없이 최신값 참조).
  const sessionIdRef = useRef(null)
  const startingRef = useRef(false)
  const endedRef = useRef(false)
  const lastCfiRef = useRef(null)
  const lastChapterRef = useRef(null)

  useEffect(() => {
    const book = rendition?.book
    if (!rendition || !book || !bookId) return

    // location.start.href → toc 라벨 매칭(v1 이식). 실패 시 null(chapter는 nullable).
    function chapterFromLocation(href) {
      try {
        if (!href || !book.navigation?.toc) return null
        const item = book.navigation.toc.find((t) =>
          href.includes(t.href.split('#')[0]),
        )
        return item?.label?.trim() || null
      } catch {
        return null
      }
    }

    // spine 위치 기반 진행률(%): (현재 섹션 index + 섹션 내 진행분) / 전체 섹션 수.
    // locations 불필요 → 동기·무오류. 섹션 길이가 달라 근사지만 진행률 바엔 충분(numeric(4,1)).
    function pctFromLocation(location) {
      const start = location?.start
      const total = book.spine?.spineItems?.length || 0
      if (!total || typeof start?.index !== 'number') return undefined
      if (location.atEnd) return 100
      const d = start.displayed
      const intra = d && d.total ? Math.min(1, Math.max(0, (d.page - 1) / d.total)) : 0
      const pct = ((start.index + intra) / total) * 100
      return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
    }

    async function onRelocated(location) {
      const loc = location?.start
      if (!loc?.cfi) return
      const cfi = loc.cfi
      const chapter = chapterFromLocation(loc.href)
      lastCfiRef.current = cfi
      lastChapterRef.current = chapter

      // ① 진척 저장(항상). pct는 spine 위치로 매번 계산(undefined면 직전 값 보존).
      try {
        await updateProgress(bookId, { cfi, pct: pctFromLocation(location) })
        // 서재 진행률 바 — 읽는 동안 BookLibrary는 미마운트라 stale 표시만(refetch는 복귀 시).
        queryClient.invalidateQueries({ queryKey: ['library'] })
      } catch (e) {
        console.error('진척 저장 실패:', e)
      }

      // ② 세션: 첫 relocated=시작, 이후=touch.
      if (sessionIdRef.current) {
        try {
          await touchSession(sessionIdRef.current, { cfi, chapter })
        } catch (e) {
          console.error('세션 touch 실패:', e)
        }
      } else if (!startingRef.current) {
        startingRef.current = true
        try {
          sessionIdRef.current = await startSession({
            bookId,
            startCfi: cfi,
            startChapter: chapter,
          })
        } catch (e) {
          console.error('세션 시작 실패:', e)
        } finally {
          startingRef.current = false
        }
      }
    }

    // visibility hidden = 활동 시각만 갱신(마감 X — 복귀 후 같은 세션 유지).
    function onVisibility() {
      if (document.visibilityState === 'hidden' && sessionIdRef.current) {
        touchSession(sessionIdRef.current, {
          cfi: lastCfiRef.current,
          chapter: lastChapterRef.current,
        }).catch(() => {})
      }
    }

    // 마감(1회만) — pagehide / 언마운트. best-effort(언마운트 후 응답은 못 기다림).
    function finish() {
      if (endedRef.current || !sessionIdRef.current) return
      endedRef.current = true
      endSession(sessionIdRef.current, {
        endCfi: lastCfiRef.current,
        endChapter: lastChapterRef.current,
      }).catch((e) => console.error('세션 마감 실패:', e))
    }

    rendition.on('relocated', onRelocated)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', finish)

    return () => {
      rendition.off('relocated', onRelocated)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', finish)
      finish()
    }
  }, [rendition, bookId, queryClient])
}
