import { useMutation } from '@tanstack/react-query'
import { askAI } from '../../services/ai'

// AI 호출은 캐시 대상 아님(frontend_arch ②) — 매번 새 호출이라 useMutation으로 감싼다.
// service의 throw → mutation.error(AIError)로 들어와 §6.8 상태 UI 분기에 쓰인다.
// 마지막 payload는 mutation.variables에 남아 재시도에 재사용.
export function useAskAI() {
  return useMutation({ mutationFn: askAI })
}
