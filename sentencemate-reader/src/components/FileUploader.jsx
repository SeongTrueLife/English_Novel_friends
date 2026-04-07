import { useState, useRef } from 'react'
import '../styles/components.css'

function FileUploader({ onFileLoaded, onOpenSettings, onOpenVocab }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function readFile(file) {
    if (!file) return
    if (!file.name.endsWith('.epub')) {
      setError('ePub 파일(.epub)만 지원합니다.')
      return
    }

    setError('')
    setIsLoading(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      const title = file.name.replace('.epub', '')
      onFileLoaded(e.target.result, title)
      setIsLoading(false)
    }
    reader.onerror = () => {
      setError('파일을 읽는 중 오류가 발생했습니다.')
      setIsLoading(false)
    }
    reader.readAsArrayBuffer(file)
  }

  function handleInputChange(e) {
    readFile(e.target.files[0])
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    readFile(e.dataTransfer.files[0])
  }

  return (
    <div className="uploader-screen">
      <div className="uploader-header">
        <span className="uploader-logo">SentenceMate</span>
        <p className="uploader-sub">영어 원서를 읽어보세요</p>
      </div>

      <div
        className={`uploader-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".epub"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        {isLoading ? (
          <div className="uploader-loading">
            <div className="spinner" />
            <p>파일 불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="uploader-icon">📚</div>
            <p className="uploader-zone-text">ePub 파일 선택하기</p>
            <p className="uploader-zone-hint">또는 파일을 여기에 드래그</p>
          </>
        )}
      </div>

      {error && <p className="uploader-error">{error}</p>}

      <div className="uploader-bottom-btns">
        <button className="uploader-settings-btn" onClick={onOpenVocab}>
          단어장
        </button>
        <button className="uploader-settings-btn" onClick={onOpenSettings}>
          설정
        </button>
      </div>
    </div>
  )
}

export default FileUploader
