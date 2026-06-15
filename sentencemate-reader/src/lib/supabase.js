// Supabase 클라이언트 — 앱 전체에서 유일한 인스턴스.
// 컴포넌트는 이 파일을 직접 import 하지 않는다(불변규칙 2): DB/AI 접근은 services/ 경유.
// 인증 부팅(bootSession)만 app 인프라가 호출한다.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '환경변수 누락: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env 확인)',
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // backend_design ②: supabase-js 기본값을 명시적으로 못 박아 둔다.
    // refresh token을 localStorage에 보관(세션 복원) + 만료 전 자동 갱신.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// 익명 부팅: 세션이 없으면 익명 user를 발급한다(backend_design ② "부팅 시 자동").
// StrictMode 이중 마운트/동시 호출 대비 — 진행 중 Promise를 재사용해 중복 발급 방지.
let bootPromise = null

export function bootSession() {
  if (!bootPromise) {
    bootPromise = (async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (data.session) return data.session

      const { data: anon, error: anonError } =
        await supabase.auth.signInAnonymously()
      if (anonError) throw anonError
      return anon.session
    })()
  }
  return bootPromise
}
