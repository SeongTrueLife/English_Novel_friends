// 클라 전용 사용자 설정의 단일 출처 (frontend_arch ②).
// fontSize/theme는 "서버 데이터가 아닌" 순수 클라 설정이라 Zustand가 올바른 자리(불변규칙 3 무관).
// persist로 localStorage에 저장 → 새로고침/재방문에도 유지.
//
// ⚠️ 이 조각(A)에선 "그릇"만. 여기 값을 epub/앱에 적용하는 배선은 다음 조각에서:
//   · fontSize 적용(themes.fontSize + 재flow 후 CFI 복원) = 조각 B
//   · theme 적용(tokens.css 다크 세트 + epub iframe 테마 동기화) = 조각 C
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSettings = create(
  persist(
    (set) => ({
      fontSize: 18, // px. useReader themes.default의 현 18px과 동일한 기본값(조각 B에서 연결)
      theme: 'light', // 'light' | 'dark' (다크 적용은 조각 C)

      setFontSize: (fontSize) => set({ fontSize }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'sm-settings' }, // localStorage 키
  ),
)
