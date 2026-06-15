const KEYS = {
  apiKey:     'gemini_api_key',
  fontSize:   'sm_font_size',
  lineHeight: 'sm_line_height',
  theme:      'sm_theme',
  vocab:      'sm_vocab',
  readingProgress: 'sm_reading_progress',
}

export const DEFAULT_SETTINGS = {
  apiKey:     '',
  fontSize:   18,
  lineHeight: 1.8,
  theme:      'light',
}

export function loadSettings() {
  return {
    apiKey:     localStorage.getItem(KEYS.apiKey)     ?? DEFAULT_SETTINGS.apiKey,
    fontSize:   Number(localStorage.getItem(KEYS.fontSize))   || DEFAULT_SETTINGS.fontSize,
    lineHeight: Number(localStorage.getItem(KEYS.lineHeight)) || DEFAULT_SETTINGS.lineHeight,
    theme:      localStorage.getItem(KEYS.theme)      ?? DEFAULT_SETTINGS.theme,
  }
}

export function saveSettings(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    if (KEYS[key] !== undefined) {
      localStorage.setItem(KEYS[key], value)
    }
  })
}

// ===========================
// 단어장
// ===========================

/**
 * 단어장 항목 구조:
 * {
 *   id: string,          // 고유 ID (timestamp 기반)
 *   word: string,        // 단어 또는 숙어
 *   explanation: string, // 설명 (AI 응답 또는 사용자 입력)
 *   bookTitle: string,   // 책 제목
 *   chapter: string,     // 챕터명
 *   createdAt: string,   // ISO 날짜
 * }
 */

export function loadVocab() {
  try {
    const raw = localStorage.getItem(KEYS.vocab)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveVocab(vocabList) {
  localStorage.setItem(KEYS.vocab, JSON.stringify(vocabList))
}

export function addVocabItem({ word, explanation, bookTitle, chapter }) {
  const list = loadVocab()
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    word,
    explanation,
    bookTitle: bookTitle || '',
    chapter: chapter || '',
    createdAt: new Date().toISOString(),
  }
  list.unshift(item) // 최신 항목이 위로
  saveVocab(list)
  return item
}

export function removeVocabItem(id) {
  const list = loadVocab().filter(item => item.id !== id)
  saveVocab(list)
  return list
}

export function exportVocabToJSON() {
  const list = loadVocab()
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sentencemate_vocab_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importVocabFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        if (!Array.isArray(imported)) throw new Error('Invalid format')
        // 기존 단어장과 병합 (중복 ID 제거)
        const existing = loadVocab()
        const existingIds = new Set(existing.map(item => item.id))
        const merged = [...existing, ...imported.filter(item => !existingIds.has(item.id))]
        saveVocab(merged)
        resolve(merged)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ===========================
// 읽은 페이지 기억
// ===========================

export function loadReadingProgress() {
  try {
    const raw = localStorage.getItem(KEYS.readingProgress)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** bookKey별로 CFI 위치를 저장 */
export function saveReadingProgress(bookKey, cfi) {
  const progress = loadReadingProgress()
  progress[bookKey] = { cfi, updatedAt: new Date().toISOString() }
  localStorage.setItem(KEYS.readingProgress, JSON.stringify(progress))
}

export function getReadingProgress(bookKey) {
  const progress = loadReadingProgress()
  return progress[bookKey]?.cfi || null
}
