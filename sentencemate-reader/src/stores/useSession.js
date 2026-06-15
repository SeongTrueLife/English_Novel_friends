// 현재 로그인 user 세션을 보관하는 Zustand store.
// 이것은 "클라이언트 상태"(이 브라우저의 인증 상태)이지 서버 데이터가 아니다 → Zustand 적격.
// (서버 데이터인 카드/라이브러리 등은 TanStack Query 캐시가 단일 출처 — 불변규칙 3.)
import { create } from 'zustand'

export const useSession = create((set) => ({
  session: null,
  user: null,
  // 'loading' = 부팅 중, 'ready' = 세션 확보, 'error' = 부팅 실패
  status: 'loading',

  // onAuthStateChange 콜백이 호출. session이 null이면 로그아웃/미부팅.
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'ready' : 'loading',
    }),

  setError: () => set({ status: 'error' }),
}))
