import { useState, useCallback, useRef } from 'react'
import { SYSTEM_PROMPT, buildUserMessage } from '../utils/systemPrompt'

const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent'

async function callGeminiStream({ apiKey, systemPrompt, userMessage, signal, onChunk }) {
  const response = await fetch(`${API_URL}?key=${apiKey}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error ${response.status}: ${err}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // 마지막 불완전 라인은 버퍼에 보관

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue
      try {
        const parsed = JSON.parse(jsonStr)
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onChunk(text)
      } catch {
        // 불완전한 JSON 청크 무시
      }
    }
  }
}

export function useGeminiAPI() {
  const [streamingText, setStreamingText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const abortControllerRef = useRef(null)

  const callAPI = useCallback(async ({ selectedText, beforeSentence, afterSentence }) => {
    const apiKey = localStorage.getItem('gemini_api_key') || ''
    if (!apiKey) {
      setError('설정에서 Gemini API 키를 입력해주세요.')
      setStreamingText('')
      return
    }

    // 이전 요청 중단
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setStreamingText('')
    setError('')
    setIsLoading(true)

    try {
      await callGeminiStream({
        apiKey,
        systemPrompt: SYSTEM_PROMPT,
        userMessage: buildUserMessage({ selectedText, beforeSentence, afterSentence }),
        signal: controller.signal,
        onChunk: (text) => {
          setStreamingText((prev) => prev + text)
        },
      })
    } catch (e) {
      if (e.name === 'AbortError') return
      console.error('[Gemini API 오류]', e.message)
      if (e.message.includes('429')) {
        setError('잠시 후 다시 시도해주세요. (API 요청 한도 초과)')
      } else if (e.message.includes('400') || e.message.includes('403')) {
        setError('API 키가 올바르지 않습니다. 설정에서 확인해주세요.')
      } else {
        setError(`오류: ${e.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return { streamingText, isLoading, error, callAPI, abort }
}
