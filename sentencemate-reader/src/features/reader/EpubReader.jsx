// M0 자리표시자 — 화면 이름만 출력. 실제 epub.js 리더는 M3.
// 이 라우트(/read/:bookId)에서는 AppShell이 탭바를 숨긴다(몰입).
import { useParams, Link } from 'react-router-dom'

export default function EpubReader() {
  const { bookId } = useParams()
  return (
    <main className="screen">
      <h1>리더 (Reader)</h1>
      <p>bookId: {bookId}</p>
      <Link to="/library">← 서재로</Link>
    </main>
  )
}
