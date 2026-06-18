// 섹션 텍스트에서 선택 문장 기준 앞/뒤 N문장 추출 (v1 utils/sentenceExtractor 이식 + 2문장·배열 확장).
// plan_v3 H: 앞뒤 2문장씩. system_prompt_v3 마커([Previous 2/1], [Next 1/2])에 매핑될 컨텍스트.

// 문장 분리 — 약어(Mr. Mrs. Dr. St. 등) 뒤 마침표는 분리하지 않음 (v1 정규식 재사용).
const SENTENCE_SPLIT_REGEX =
  /(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|etc|vs|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\.\s+|[!?]\s+/

// sectionText에서 selected 포함 문장을 찾아 앞 before개·뒤 after개를 읽기순 배열로 반환.
// 반환: { prev: string[], next: string[] } (prev의 마지막 = 선택문장 바로 앞, next의 첫 = 바로 뒤).
// 못 찾으면 { prev: [], next: [] }. 동일 문장 중복 시 첫 매치(MVP 한계).
export function extractContext(sectionText, selected, { before = 2, after = 2 } = {}) {
  const target = selected?.trim()
  if (!sectionText || !target) return { prev: [], next: [] }

  const sentences = sectionText
    .split(SENTENCE_SPLIT_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  // 선택 텍스트를 포함하는(또는 선택이 포함하는) 문장 인덱스 (v1 양방향 includes).
  const idx = sentences.findIndex(
    (s) => s.includes(target) || target.includes(s),
  )
  if (idx === -1) return { prev: [], next: [] }

  return {
    prev: sentences.slice(Math.max(0, idx - before), idx),
    next: sentences.slice(idx + 1, idx + 1 + after),
  }
}
