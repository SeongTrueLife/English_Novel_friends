// 인증(익명↔이메일) 호출 단일 경유 계층 (backend_design ②).
// 컴포넌트는 supabase.auth를 직접 모른다(불변규칙 2) — 연동/로그인/로그아웃은 이 파일만 경유.
// 실패 시 throw(규칙 1) → UI가 try/catch로 인라인 에러.
// 인증 "상태"(익명/연동됨) 읽기는 호출이 아니라 stores/useSession에서 파생한다.
import { supabase } from '../lib/supabase'

// 확인 링크 클릭 후 돌아올 앱 라우트. dev=localhost:5173, 배포 시 그 origin.
// ※ Supabase 대시보드 Auth → URL Configuration의 Redirect URLs 허용목록에 이 origin이 있어야 함.
const emailRedirectTo = `${window.location.origin}/vocab`

// 익명 user에 이메일+비번을 연결한다 — 같은 user_id 유지(모델 2), 데이터 그대로 승계.
// linkIdentity는 OAuth 전용 → 이메일/비번은 updateUser가 정답(실증 확인: 단일 호출로 비번까지 수락,
// 검증은 확인 링크 클릭 시 완료). 확인 메일은 "Change Email Address" 템플릿으로 발송된다.
export async function linkEmail({ email, password }) {
  const { data, error } = await supabase.auth.updateUser(
    { email, password },
    { emailRedirectTo },
  )
  if (error) throw error
  return data.user
}

// 기존 계정으로 로그인(다른 기기 복원). 현재 익명 세션을 대체한다 —
// 이 기기의 익명 데이터는 병합되지 않으므로(주의) UI에서 경고 후 호출한다.
export async function signInEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

// 로그아웃 후 곧바로 익명 세션을 재발급해 앱이 계속 동작하게 한다.
// (lib/supabase의 bootSession은 메모이즈되어 재로그인을 트리거하지 못하므로 여기서 직접 발급.)
// onAuthStateChange가 두 변화를 store에 반영한다.
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  const { error: anonError } = await supabase.auth.signInAnonymously()
  if (anonError) throw anonError
}
