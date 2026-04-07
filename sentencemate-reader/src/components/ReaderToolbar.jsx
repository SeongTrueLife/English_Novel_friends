import '../styles/components.css'

function ReaderToolbar({ bookTitle, onBack, onOpenSettings, onOpenVocab }) {
  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={onBack} aria-label="파일 선택으로 돌아가기">
        ←
      </button>

      <span className="toolbar-title">
        {bookTitle || 'SentenceMate'}
      </span>

      <div className="toolbar-right">
        <button className="toolbar-btn" onClick={onOpenVocab} aria-label="단어장" title="단어장">
          Aa
        </button>
        <button className="toolbar-btn" onClick={onOpenSettings} aria-label="설정">
          ⚙
        </button>
      </div>
    </div>
  )
}

export default ReaderToolbar
