// AI 데이터 접근 계층 (backend_design ③). 컴포넌트는 이 파일을 통해서만 Edge Function 호출(불변규칙 2).
// 실패 시 throw(규칙 1) — 에러 코드(401/429/502)를 살려서 §6.8 메시지 매핑에 쓴다.
import { supabase } from '../lib/supabase'

// 호출 측이 분기할 수 있게 의미 코드를 담은 에러.
// code: 'unauthorized' | 'quota_exceeded' | 'ai_failed' | 'network' | 'unknown'
export class AIError extends Error {
  constructor(code, status) {
    super(code)
    this.name = 'AIError'
    this.code = code
    this.status = status // 401 | 429 | 502 | null
  }
}

// 함수 응답 body({ error })를 못 읽었을 때 status로 코드 역추정.
const statusToCode = (s) =>
  s === 401
    ? 'unauthorized'
    : s === 429
      ? 'quota_exceeded'
      : s === 502
        ? 'ai_failed'
        : 'unknown'

// 선택 문장 + 앞뒤 맥락을 Edge Function 'ask-ai'에 보내 v3 JSON을 받는다.
// invoke가 현재 세션 JWT·apikey를 자동 첨부(직접 헤더 X). 시스템 프롬프트·키·스키마는 서버에만(B 전략).
// 배열 순서 계약: prev=[Previous 2, Previous 1], next=[Next 1, Next 2] (buildUserMessage와 일치).
export async function askAI({
  bookInfo,
  prev = [],
  selected,
  next = [],
  userRequest,
  history = [],
}) {
  const { data, error } = await supabase.functions.invoke('ask-ai', {
    body: { bookInfo, prev, selected, next, userRequest, history },
  })

  if (error) {
    // FunctionsHttpError면 error.context가 non-2xx Response(body { error: code }).
    // FunctionsFetchError/Relay(네트워크 등)면 context.status가 없다.
    const ctx = error.context
    if (ctx && typeof ctx.status === 'number') {
      let code
      try {
        code = (await ctx.json())?.error
      } catch {
        /* body 못 읽음 → status로 역추정 */
      }
      throw new AIError(code ?? statusToCode(ctx.status), ctx.status)
    }
    throw new AIError('network', null)
  }

  // 서버 반환: { answer: v3 JSON, userMessage }.
  // answer = { vocab, grammar, sentence_thinking, naturalTranslation }.
  // userMessage = 서버가 조립한 이번 턴 user 텍스트(클라가 history 누적용으로 그대로 echo, M6).
  return data // { answer, userMessage }
}
