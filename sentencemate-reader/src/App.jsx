// 화면 지도(라우트 정의) + 인증 부팅 배선.
// arch ①: 6개 라우트 + '/' → '/library' redirect. AppShell을 레이아웃 라우트로 감싼다.
import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { supabase, bootSession } from './lib/supabase'
import { useSession } from './stores/useSession'
import AppShell from './app/AppShell'

import BookLibrary from './features/library/BookLibrary'
import EpubReader from './features/reader/EpubReader'
import VocabList from './features/vocab/VocabList'
import FlashcardStudy from './features/vocab/FlashcardStudy'
import StatsDashboard from './features/stats/StatsDashboard'
import BookStats from './features/stats/BookStats'

export default function App() {
  const setSession = useSession((s) => s.setSession)
  const setError = useSession((s) => s.setError)

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
        {/* M8-A에서 실제 가이드 페이지로 대체. 지금은 깨짐 방지용 자리. */}
        <Route path="/guide" element={<GuideStub />} />
      </Route>
    </Routes>
  )
}

// 가이드 스텁 — AccountSheet "가이드 다시 보기"의 착지점(다음 조각 M8-A에서 구현).
function GuideStub() {
  return (
    <main className="screen">
      <div className="state">
        <h2 className="state__title">가이드</h2>
        <p className="state__msg">곧 제공돼요.</p>
      </div>
    </main>
  )
}
