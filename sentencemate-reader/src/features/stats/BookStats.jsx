// M0 자리표시자 — 화면 이름만 출력. 실제 책별 상세 통계는 M7.
import { useParams, Link } from 'react-router-dom'

export default function BookStats() {
  const { bookId } = useParams()
  return (
    <main className="screen">
      <h1>책별 상세 통계 (Book Stats)</h1>
      <p>bookId: {bookId}</p>
      <Link to="/stats">← 통계로</Link>
    </main>
  )
}
