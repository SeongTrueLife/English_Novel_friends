// 문장 분리 정규식 — 약어(Mr. Mrs. Dr. St. 등)는 분리하지 않음
const SENTENCE_SPLIT_REGEX = /(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|etc|vs|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\.\s+|[!?]\s+/

/**
 * 전체 텍스트에서 선택 문장의 앞뒤 1문장을 추출
 * @param {string} fullText - 단락 전체 텍스트
 * @param {string} selectedText - 사용자가 선택한 텍스트
 * @returns {{ before: string, after: string }}
 */
export function extractContext(fullText, selectedText) {
  if (!fullText || !selectedText) return { before: '', after: '' }

  const sentences = fullText
    .split(SENTENCE_SPLIT_REGEX)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  // 선택 텍스트를 포함하는 문장 인덱스 탐색
  const selectedIndex = sentences.findIndex(s =>
    s.includes(selectedText.trim()) || selectedText.trim().includes(s)
  )

  if (selectedIndex === -1) {
    return { before: '', after: '' }
  }

  return {
    before: selectedIndex > 0 ? sentences[selectedIndex - 1] : '',
    after: selectedIndex < sentences.length - 1 ? sentences[selectedIndex + 1] : '',
  }
}
