// 화면 지도(라우트 정의) + 인증 부팅 배선.
// arch ①: 6개 라우트 + '/' → '/library' redirect. AppShell을 레이아웃 라우트로 감싼다.
import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'

import { supabase, bootSession } from './lib/supabase'
import { useSession } from './stores/useSession'
import { useSettings } from './stores/useSettings'
import AppShell from './app/AppShell'

import BookLibrary from './features/library/BookLibrary'
import EpubReader from './features/reader/EpubReader'
import VocabList from './features/vocab/VocabList'
import FlashcardStudy from './features/vocab/FlashcardStudy'
import StatsDashboard from './features/stats/StatsDashboard'
import BookStats from './features/stats/BookStats'
import GuidePage from './features/guide/GuidePage'

export default function App() {
  const setSession = useSession((s) => s.setSession)
  const setError = useSession((s) => s.setError)
  const navigate = useNavigate()

  useEffect(() => {
    // 1) 익명 부팅(세션 없으면 발급). 2) 이후 인증 변화를 store에 반영.
    // onAuthStateChange는 구독 즉시 현재 세션으로 한 번 발화하므로 store가 채워진다.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    bootSession().catch((err) => {
      console.error('익명 부팅 실패:', err)
      setError()
    })

    return () => sub.subscription.unsubscribe()
  }, [setSession, setError])

  // 다크모드 단일 기록자(조각 C) — useSettings.theme를 document.documentElement[data-theme]에 반영.
  // FOUC 스크립트(index.html)가 mount 전 초기값을 깔고, 여기선 mount 시 재확인 + 변경 구독.
  // zustand subscribe는 setTheme 호출 시 동기 실행 → data-theme가 리렌더보다 먼저 갱신(iframe 색 읽기 레이스 제거).
  useEffect(() => {
    const apply = (theme) => {
      document.documentElement.dataset.theme = theme
    }
    apply(useSettings.getState().theme)
    return useSettings.subscribe((s) => apply(s.theme))
  }, [])

  // 첫 실행 1회 자동 가이드 노출(§6.9). guideSeen이 없으면 부팅 직후 /guide로 유도.
  // "시작하기"가 guideSeen을 켜므로 이후엔 안 뜬다. "가이드 다시 보기"는 이 플래그와 무관.
  useEffect(() => {
    if (!localStorage.getItem('guideSeen')) navigate('/guide', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<BookLibrary />} />
        <Route path="/read/:bookId" element={<EpubReader />} />
        <Route path="/vocab" element={<VocabList />} />
        <Route path="/vocab/study" element={<FlashcardStudy />} />
        <Route path="/stats" element={<StatsDashboard />} />
        <Route path="/stats/:bookId" element={<BookStats />} />
        <Route path="/guide" element={<GuidePage />} />
      </Route>
    </Routes>
  )
}
