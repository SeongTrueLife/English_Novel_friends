import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveWordCard, saveGrammarCard } from '../../services/cards'

// AI 응답 항목의 ⊕ 저장을 감싸는 mutation (frontend_arch ②). 응답은 query가 아니므로 캐시 X.
// kind로 services/cards의 알맞은 저장 함수를 고른다(불변규칙 2: DB 접근은 service 경유).
// onSuccess에 ['cards'] 무효화 → sub-#3 단어장(useQuery(['cards']))이 새 카드를 자동 반영.
export function useSaveCard(kind) {
  const qc = useQueryClient()
  const mutationFn = kind === 'word' ? saveWordCard : saveGrammarCard
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}
