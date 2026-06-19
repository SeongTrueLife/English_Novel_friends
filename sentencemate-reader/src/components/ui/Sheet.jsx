// 공통 바텀시트 셸 (CLAUDE.md 폴더 구조 — components/ui/Sheet).
// 백드롭 + 하단 패널 + 헤더(title·✕) + 스크롤 바디. backdrop 클릭/Esc로 닫힘.
// 클래스 네임스페이스는 ui-sheet__*  — library의 전역 .sheet*(AddBookSheet.css)와 충돌 방지.
// (기존 AddBookSheet/AccountSheet/AIResponse는 이 프리미티브로 옮기지 않는다 — 범위 밖.)
import { useEffect } from 'react'
import './Sheet.css'

export default function Sheet({ title, onClose, children }) {
  // Esc 닫기 — 시트가 떠 있는 동안만.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ui-sheet-backdrop" onClick={onClose}>
      <div
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ui-sheet__head">
          <h2 className="ui-sheet__title">{title}</h2>
          <button
            type="button"
            className="ui-sheet__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>
        <div className="ui-sheet__body">{children}</div>
      </div>
    </div>
  )
}
