import { useQuery } from '@tanstack/react-query'
import { getBook } from '../../services/books'
import { useSession } from '../../stores/useSession'

// 단건 책 메타 서버 캐시(source/title). service getBook을 감쌈(불변규칙 2·3).
// queryKey ['book', bookId]. 익명 세션 준비 + bookId 있을 때만 실행(useLibrary 패턴).
export function useBook(bookId) {
  const ready = useSession((s) => s.status === 'ready')
  return useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBook(bookId),
    enabled: ready && !!bookId,
  })
}
