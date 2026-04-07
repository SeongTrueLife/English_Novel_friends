import { useState, useMemo, useEffect, useRef } from 'react'
import '../styles/bottomSheet.css'

/**
 * **text** → <strong>text</strong> 변환
 */
function renderBold(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  )
}

/**
 * 텍스트를 줄 단위로 렌더링
 */
function renderLines(text) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return <div key={i} className="ai-empty-line" />
    return (
      <p key={i} className="ai-line">
        {renderBold(trimmed)}
      </p>
    )
  })
}

/**
 * 전체 응답 텍스트를 3단계로 파싱
 * - 구분 기준: 줄 단위의 --- (공백 허용)
 * - 헤더 감지: 📖 / 📝 / 💡 이모지 포함 여부 (### 접두사 등 허용)
 */
function parseStages(text) {
  // --- 구분선으로 분리 (앞뒤 공백 허용)
  const raw = text.split(/\n\s*---\s*\n/)
  const stages = []

  for (const part of raw) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const lines = trimmed.split('\n')
    const firstLine = lines[0].trim()

    // 이모지 포함 여부로 단계 헤더 감지
    const isStageHeader =
      firstLine.includes('📖') ||
      firstLine.includes('📝') ||
      firstLine.includes('💡')

    // 헤더에서 ### 등 마크다운 접두사 제거
    const cleanHeader = firstLine.replace(/^#+\s*/, '').trim()
    const body = lines.slice(1).join('\n').trim()

    if (isStageHeader) {
      stages.push({ header: cleanHeader, body })
    } else {
      // 헤더 없는 텍스트는 이전 단계에 이어붙이거나 새 항목으로
      if (stages.length > 0) {
        stages[stages.length - 1].body += '\n\n' + trimmed
      } else {
        stages.push({ header: '', body: trimmed })
      }
    }
  }

  return stages
}

/**
 * 단일 단계 섹션 (접기/펼치기)
 */
function StageSection({ header, body, defaultOpen, isStreaming }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef(null)

  // 스트리밍 중 1단계(펼쳐진 상태)의 스크롤을 최신 내용으로 유지
  useEffect(() => {
    if (open && isStreaming && bodyRef.current) {
      bodyRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [body, open, isStreaming])

  return (
    <div className="ai-stage">
      {header && (
        <button
          className={`ai-stage-header ${open ? 'open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="ai-stage-title">{header}</span>
          <span className="ai-stage-arrow">{open ? '▾' : '▸'}</span>
        </button>
      )}

      {/* CSS grid 트릭으로 부드러운 높이 애니메이션 */}
      <div className={`ai-stage-body-wrapper ${open ? 'open' : ''}`}>
        <div className="ai-stage-body" ref={bodyRef}>
          {renderLines(body)}
          {isStreaming && <span className="ai-cursor" />}
        </div>
      </div>
    </div>
  )
}

function AIResponse({ selectedText, streamingText, isLoading, error, onAddVocab }) {
  const stages = useMemo(() => parseStages(streamingText), [streamingText])
  const [vocabToast, setVocabToast] = useState('')
  const [vocabBtnVisible, setVocabBtnVisible] = useState(false)
  const vocabSelectedRef = useRef('')

  // document 레벨에서 텍스트 선택 감지 (ref 타이밍 문제 회피)
  useEffect(() => {
    if (!onAddVocab) return

    let selectionTimer = null

    function handleSelectionChange() {
      clearTimeout(selectionTimer)
      selectionTimer = setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim()
        if (!text || text.length < 2) {
          setVocabBtnVisible(false)
          return
        }
        const anchor = sel.anchorNode?.parentElement
        const responseEl = anchor?.closest('.ai-response')
        if (!responseEl) {
          setVocabBtnVisible(false)
          return
        }
        vocabSelectedRef.current = text
        setVocabBtnVisible(true)
      }, 200)
    }

    function handleMouseDown(e) {
      if (e.target.closest?.('.vocab-add-float-btn')) return
      setVocabBtnVisible(false)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('touchstart', handleMouseDown, { passive: true })

    return () => {
      clearTimeout(selectionTimer)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('touchstart', handleMouseDown)
    }
  }, [onAddVocab])

  function handleVocabClick() {
    const text = vocabSelectedRef.current
    if (!text || !onAddVocab) return
    onAddVocab(selectedText, text)
    setVocabBtnVisible(false)
    setVocabToast('단어장에 추가되었습니다!')
    setTimeout(() => setVocabToast(''), 2000)
    window.getSelection()?.removeAllRanges()
  }

  if (error) {
    return <div className="ai-error">{error}</div>
  }

  if (isLoading && !streamingText) {
    return (
      <div className="ai-loading">
        <div className="spinner" />
        <p>분석 중...</p>
      </div>
    )
  }

  if (!streamingText) return null

  return (
    <div className="ai-response">
      {/* 선택 문장 표시 */}
      {selectedText && (
        <div className="ai-selected-text">
          <span className="ai-selected-label">선택한 문장</span>
          <p className="ai-selected-content">"{selectedText}"</p>
        </div>
      )}

      {stages.map((stage, i) => (
        <StageSection
          key={i}
          header={stage.header}
          body={stage.body}
          defaultOpen={i === 0}
          isStreaming={isLoading && i === stages.length - 1}
        />
      ))}

      {vocabBtnVisible && (
        <button
          className="vocab-add-float-btn"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onTouchStart={(e) => { e.stopPropagation() }}
          onClick={handleVocabClick}
        >
          + 단어장에 추가
        </button>
      )}

      {vocabToast && <div className="vocab-toast">{vocabToast}</div>}
    </div>
  )
}

export default AIResponse
