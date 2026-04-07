import '../styles/components.css'

function ReaderToolbar({ bookTitle, onBack, onOpenSettings }) {
  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={onBack} aria-label="파일 선택으로 돌아가기">
        ←
      </button>

      <span className="toolbar-title">
        {bookTitle || 'SentenceMate'}
      </span>

      <div className="toolbar-right">
        <button className="toolbar-btn" onClick={onOpenSettings} aria-label="설정">
          ⚙
        </button>
      </div>
    </div>
  )
}

export default ReaderToolbar
