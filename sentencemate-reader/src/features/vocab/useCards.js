import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCards, deleteCard } from '../../services/cards'
import { useSession } from '../../stores/useSession'

// 단어장 서버 캐시. service getCards를 그대로 감쌈(불변규칙 2·3). useLibrary와 같은 게이팅 패턴.
// queryKey에 kind를 넣어 단어/문법 탭 캐시를 분리. 익명 세션 ready 후 실행해 빈 결과 캐싱 방지.
export function useCards(kind) {
  const ready = useSession((s) => s.status === 'ready')
  return useQuery({
    queryKey: ['cards', { kind }],
    queryFn: () => getCards({ kind }),
    enabled: ready,
  })
}

// 카드 삭제 mutation. onSuccess에 ['cards'] 무효화 → 접두 매칭으로 단어/문법 양 탭 모두 갱신.
// (sub-#2 useSaveCard의 invalidate와 동일 키 컨벤션.)
export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCard,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}
