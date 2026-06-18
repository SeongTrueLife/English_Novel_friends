import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { askAI } from '../../services/ai'

// follow-up 멀티턴 대화 상태 (M6, frontend_arch ②: AI는 캐시 X → mutation 누적).
// 한 문장 세션의 턴을 messages로 누적. 다른 문장 선택 시 start()가 reset → 새 세션(휘발성, DB 미저장).
//
// messages 모델:
//   { role:'user',  display, text }  — display=화면용(turn1은 앵커에 이미 있어 null) / text=서버 history용
//   { role:'model', answer, text }   — answer=v3 JSON(렌더) / text=JSON 문자열(서버 history용)
// 서버 전송 history = messages.map(({role,text}) => ({role,text})).
//
// history echo(서버 단일 출처): turn1 user.text는 서버가 조립한 userMessage를 그대로 보관.
//   follow-up user.text는 질문 그 자체(서버도 userRequest를 echo) → 낙관적으로 즉시 표시 가능.
export function useConversation() {
  const [messages, setMessages] = useState([])
  const mutation = useMutation({ mutationFn: askAI })

  const reset = useCallback(() => {
    setMessages([])
    mutation.reset()
  }, [mutation])

  // turn-1: 문장 맥락으로 첫 호출. 이전 대화 비우고 새 세션.
  // 실패는 mutation.isError/error로 surface → 여기선 reject만 삼킨다(unhandled 방지).
  const start = useCallback(
    async ({ bookInfo, prev, selected, next }) => {
      setMessages([])
      mutation.reset()
      try {
        const { answer, userMessage } = await mutation.mutateAsync({
          bookInfo,
          prev,
          selected,
          next,
          history: [],
        })
        setMessages([
          { role: 'user', display: null, text: userMessage }, // 질문=앵커 문장 → 화면 표시 없음
          { role: 'model', answer, text: JSON.stringify(answer) },
        ])
      } catch {
        /* mutation.error로 surface */
      }
    },
    [mutation],
  )

  // follow-up: 같은 문장 맥락(history)으로 추가 질문. selected는 첫 user.text에 이미 들어있어
  //   서버는 history가 있으면 마커 재조립 생략 → userRequest를 그 턴으로.
  const followUp = useCallback(
    async (question) => {
      const q = question.trim()
      if (!q) return
      const history = messages.map((m) => ({ role: m.role, text: m.text }))
      const selected = messages[0]?.text // turn1 user 텍스트(맥락) — 서버 검증 통과용
      // 질문 버블을 낙관적으로 먼저 표시(실패해도 유지 — 그 아래 에러뷰+재시도).
      setMessages((prev) => [...prev, { role: 'user', display: q, text: q }])
      try {
        const { answer } = await mutation.mutateAsync({
          selected,
          userRequest: q,
          history,
        })
        setMessages((prev) => [
          ...prev,
          { role: 'model', answer, text: JSON.stringify(answer) },
        ])
      } catch {
        /* 질문 버블 유지 + mutation.error로 에러뷰 표시 */
      }
    },
    [messages, mutation],
  )

  // 마지막 실패한 호출 재실행(payload는 mutation.variables에 남아있음).
  // turn1 실패면 messages가 비어있고, follow-up 실패면 질문 버블이 남아있는 상태에서 재시도.
  const retry = useCallback(async () => {
    const vars = mutation.variables
    if (!vars) return
    try {
      const { answer, userMessage } = await mutation.mutateAsync(vars)
      if (vars.history?.length) {
        // follow-up 재시도: 질문 버블은 이미 있음 → model 턴만 추가.
        setMessages((prev) => [
          ...prev,
          { role: 'model', answer, text: JSON.stringify(answer) },
        ])
      } else {
        setMessages([
          { role: 'user', display: null, text: userMessage },
          { role: 'model', answer, text: JSON.stringify(answer) },
        ])
      }
    } catch {
      /* mutation.error로 surface */
    }
  }, [mutation])

  return {
    messages,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    start,
    followUp,
    retry,
    reset,
  }
}
