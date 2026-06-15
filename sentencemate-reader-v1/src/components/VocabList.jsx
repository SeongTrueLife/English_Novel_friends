import { useState, useEffect } from 'react'
import { loadVocab, removeVocabItem, exportVocabToJSON, importVocabFromJSON } from '../utils/storage'
import '../styles/vocab.css'

function VocabList({ isOpen, onClose }) {
  const [vocab, setVocab] = useState([])
  const [filter, setFilter] = useState('') // 책 제목 필터
  const [isVisible, setIsVisible] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setVocab(loadVocab())
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  function handleDelete(id) {
    const updated = removeVocabItem(id)
    setVocab(updated)
  }

  function handleExport() {
    exportVocabToJSON()
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    importVocabFromJSON(file)
      .then((merged) => setVocab(merged))
      .catch(() => alert('파일 형식이 올바르지 않습니다.'))
    e.target.value = ''
  }

  // 책 제목별 그룹
  const bookTitles = [...new Set(vocab.map(v => v.bookTitle).filter(Boolean))]
  const filtered = filter
    ? vocab.filter(v => v.bookTitle === filter)
    : vocab

  if (!isOpen) return null

  return (
    <>
      <div
        className={`vocab-overlay ${isVisible ? 'vocab-overlay--visible' : ''}`}
        onClick={onClose}
      />
      <div className={`vocab-panel ${isVisible ? 'vocab-panel--visible' : ''}`}>
        {/* 헤더 */}
        <div className="vocab-header">
          <h2 className="vocab-title">단어장</h2>
          <button className="vocab-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {/* 필터 + 액션 */}
        <div className="vocab-actions">
          <select
            className="vocab-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">전체 ({vocab.length})</option>
            {bookTitles.map(title => (
              <option key={title} value={title}>
                {title} ({vocab.filter(v => v.bookTitle === title).length})
              </option>
            ))}
          </select>

          <div className="vocab-action-btns">
            <button className="vocab-action-btn" onClick={handleExport} title="내보내기">
              내보내기
            </button>
            <label className="vocab-action-btn" title="가져오기">
              가져오기
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* 단어 목록 */}
        <div className="vocab-body">
          {filtered.length === 0 ? (
            <div className="vocab-empty">
              <p>저장된 단어가 없습니다.</p>
              <p className="vocab-empty-hint">
                AI 응답에서 텍스트를 선택하면<br />단어장에 추가할 수 있습니다.
              </p>
            </div>
          ) : (
            <ul className="vocab-list">
              {filtered.map(item => (
                <li
                  key={item.id}
                  className={`vocab-item ${expandedId === item.id ? 'vocab-item--expanded' : ''}`}
                >
                  <button
                    className="vocab-item-header"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <span className="vocab-word">{item.word}</span>
                    <span className="vocab-meta">
                      {item.chapter || item.bookTitle}
                    </span>
                  </button>

                  {expandedId === item.id && (
                    <div className="vocab-item-body">
                      <p className="vocab-explanation">{item.explanation}</p>
                      <div className="vocab-item-footer">
                        <span className="vocab-date">
                          {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                        <button
                          className="vocab-delete-btn"
                          onClick={() => handleDelete(item.id)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

export default VocabList
