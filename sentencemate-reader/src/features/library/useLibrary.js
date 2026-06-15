import { useQuery } from '@tanstack/react-query'
import { getLibrary } from '../../services/books'
import { useSession } from '../../stores/useSession'

// 서재 목록 서버 캐시. service getLibrary를 그대로 감쌈(불변규칙 2·3).
// queryKey 컨벤션: ['library'] (frontend_arch ②). 익명 세션 준비 후 실행해 빈 결과 캐싱 방지.
export function useLibrary() {
  const ready = useSession((s) => s.status === 'ready')
  return useQuery({
    queryKey: ['library'],
    queryFn: getLibrary,
    enabled: ready,
  })
}
