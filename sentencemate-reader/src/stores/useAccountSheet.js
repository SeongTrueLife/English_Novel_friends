// 계정 시트(오버레이) 열림 상태 — 클라 UI 상태이지 서버 데이터가 아니다(불변규칙 3 무관).
// 라우트 형제(AppShell 계정 아이콘 ↔ VocabList 소프트 힌트)가 prop drilling 없이
// 같은 시트를 열기 위한 최소 전역 상태. 시트 자체는 AppShell이 렌더한다.
import { create } from 'zustand'

export const useAccountSheet = create((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
}))
