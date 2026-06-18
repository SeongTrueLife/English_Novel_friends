// 읽기 세션 데이터 접근 계층 (backend_design ③, db_schema 결정 6: A+C+last_activity_at).
// 컴포넌트는 이 파일을 통해서만 reading_sessions에 접근(불변규칙 2). 실패 시 throw(규칙 1).
// user_id는 인자로 안 받음 — RLS(auth.uid())가 격리, INSERT만 getUser로 채움. (cards.js 패턴.)
import { supabase } from '../lib/supabase'

// 인증된 user 반환 — INSERT의 user_id 채울 때. cards.js requireUser와 동일 패턴.
async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('인증 세션 없음 — 읽기 세션을 시작할 수 없습니다.')
  return user
}

// 새 읽기 세션 시작. 먼저 이전 미종료 세션(ended_at NULL)을 모두 자동 마감(결정 6의 A+C 안전망),
// 그 뒤 새 행 INSERT 후 session_id 반환.
// 자동 마감: PostgREST는 `컬럼 = 다른컬럼` UPDATE가 안 되므로 미종료 행을 읽어 각 행의
//   last_activity_at을 ended_at으로 복사(보통 0~1행, 가벼움). RLS가 본인 행만 보장.
export async function startSession({ bookId, startCfi, startChapter }) {
  const user = await requireUser()

  // ① 이전 미종료 세션 정리(앱 강제종료 등으로 마감 못 한 것).
  const { data: unended, error: selErr } = await supabase
    .from('reading_sessions')
    .select('session_id, last_activity_at')
    .is('ended_at', null)
  if (selErr) throw selErr
  for (const s of unended ?? []) {
    const { error } = await supabase
      .from('reading_sessions')
      .update({ ended_at: s.last_activity_at })
      .eq('session_id', s.session_id)
    if (error) throw error
  }

  // ② 새 세션 INSERT. end_*는 start_*로 초기화 → 한 쪽도 안 넘긴 세션도 위치 보유.
  //    started_at = last_activity_at = now (CHECK last_activity_at >= started_at 충족).
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('reading_sessions')
    .insert({
      user_id: user.id,
      book_id: bookId,
      started_at: now,
      last_activity_at: now,
      start_cfi: startCfi,
      start_chapter: startChapter,
      end_cfi: startCfi,
      end_chapter: startChapter,
    })
    .select('session_id')
    .single()
  if (error) throw error
  return data.session_id
}

// 활동 갱신 — 쪽넘김·visibility hidden 시. last_activity_at + 현재 위치(end_*) 갱신.
// (best-effort 마감의 기준 시각이 되므로 활동마다 신선하게 유지.)
export async function touchSession(sessionId, { cfi, chapter }) {
  const { error } = await supabase
    .from('reading_sessions')
    .update({
      last_activity_at: new Date().toISOString(),
      end_cfi: cfi,
      end_chapter: chapter,
    })
    .eq('session_id', sessionId)
  if (error) throw error
}

// 세션 마감 — 리더 떠남(언마운트)·pagehide. ended_at + 최종 위치(end_*).
export async function endSession(sessionId, { endCfi, endChapter }) {
  const { error } = await supabase
    .from('reading_sessions')
    .update({
      ended_at: new Date().toISOString(),
      end_cfi: endCfi,
      end_chapter: endChapter,
    })
    .eq('session_id', sessionId)
  if (error) throw error
}
