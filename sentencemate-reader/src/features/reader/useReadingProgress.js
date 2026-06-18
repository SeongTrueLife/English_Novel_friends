import { useQuery } from '@tanstack/react-query'
import { getReadingProgress } from '../../services/books'
import { useSession } from '../../stores/useSession'

// 이어 읽기 시작 CFI 공급(user_books.progress_cfi). service getReadingProgress를 감쌈(불변규칙 2·3).
// queryKey ['progress', bookId]. 익명 세션 준비 + bookId 있을 때만 실행(useBook 패턴).
// 진척 저장(updateProgress) 성공 시 useReadingSession이 이 키를 무효화 → 재진입 시 최신 위치 복원.
export function useReadingProgress(bookId) {
  const ready = useSession((s) => s.status === 'ready')
  return useQuery({
    queryKey: ['progress', bookId],
    queryFn: () => getReadingProgress(bookId),
    enabled: ready && !!bookId,
  })
}
