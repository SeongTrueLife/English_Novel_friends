import { useState, useEffect } from 'react'
import '../styles/components.css'

const THEMES = [
  { id: 'light', label: '밝음',   bg: '#fefefe', color: '#2c2c2c' },
  { id: 'sepia', label: '세피아', bg: '#f4ecd8', color: '#5c4b37' },
  { id: 'dark',  label: '다크',   bg: '#1a1a2e', color: '#e0e0e0' },
]

function SettingsPanel({ isOpen, onClose, settings, onSave }) {
  const [local, setLocal] = useState(settings)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLocal(settings)
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [isOpen, settings])

  function set(key, value) {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (!local.apiKey.trim()) {
      alert('Gemini API 키를 입력해주세요.')
      return
    }
    onSave(local)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={`settings-overlay ${isVisible ? 'settings-overlay--visible' : ''}`}>
      <div className={`settings-panel ${isVisible ? 'settings-panel--visible' : ''}`}>

        {/* 헤더 */}
        <div className="settings-header">
          <span className="settings-title">⚙ 설정</span>
          <button className="settings-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="settings-body">

          {/* API 키 */}
          <div className="settings-section">
            <label className="settings-label">Gemini API 키</label>
            <div className="settings-input-row">
              <input
                className="settings-input"
                type={showApiKey ? 'text' : 'password'}
                value={local.apiKey}
                onChange={e => set('apiKey', e.target.value)}
                placeholder="API 키를 입력하세요"
                spellCheck={false}
              />
              <button
                className="settings-eye-btn"
                onClick={() => setShowApiKey(v => !v)}
                aria-label={showApiKey ? '숨기기' : '보기'}
              >
                {showApiKey ? '🙈' : '👁'}
              </button>
            </div>
            <p className="settings-hint">
              Google AI Studio에서 발급한 키를 입력하세요. 브라우저에만 저장됩니다.
            </p>
          </div>

          {/* 폰트 크기 */}
          <div className="settings-section">
            <label className="settings-label">
              폰트 크기 <span className="settings-value">{local.fontSize}px</span>
            </label>
            <input
              className="settings-range"
              type="range"
              min={14} max={28} step={1}
              value={local.fontSize}
              onChange={e => set('fontSize', Number(e.target.value))}
            />
            <div className="settings-range-labels">
              <span>작게 (14)</span><span>크게 (28)</span>
            </div>
          </div>

          {/* 줄간격 */}
          <div className="settings-section">
            <label className="settings-label">
              줄간격 <span className="settings-value">{local.lineHeight.toFixed(1)}</span>
            </label>
            <input
              className="settings-range"
              type="range"
              min={1.4} max={2.2} step={0.1}
              value={local.lineHeight}
              onChange={e => set('lineHeight', Number(e.target.value))}
            />
            <div className="settings-range-labels">
              <span>좁게 (1.4)</span><span>넓게 (2.2)</span>
            </div>
          </div>

          {/* 테마 */}
          <div className="settings-section">
            <label className="settings-label">테마</label>
            <div className="settings-theme-row">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`settings-theme-btn ${local.theme === t.id ? 'active' : ''}`}
                  style={{ background: t.bg, color: t.color }}
                  onClick={() => set('theme', t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 저장 버튼 */}
        <div className="settings-footer">
          <button className="settings-save-btn" onClick={handleSave}>저장하기</button>
        </div>

      </div>
    </div>
  )
}

export default SettingsPanel
