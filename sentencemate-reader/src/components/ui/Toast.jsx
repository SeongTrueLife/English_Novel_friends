import { useEffect } from 'react'
import './Toast.css'

// 하단 고정 토스트 — 절제된 단발성 알림(§6.2: 실패 같은 예외만, 성공은 인라인 ✓로 충분).
// 큐 없음(메시지 하나). aria-live="polite"로 스크린리더에 알리고 duration 후 자동 소멸.
export default function Toast({ message, onDismiss, duration = 3000 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
