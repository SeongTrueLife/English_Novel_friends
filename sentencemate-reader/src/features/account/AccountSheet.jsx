// 계정 시트 (frontend_plan §6.9) — 라우트가 아니라 AppShell이 여닫는 오버레이.
// 비강요 진입점: 상태(익명/연동대기/연동됨) 표시 + 이메일 연동 / 기존계정 로그인 / 로그아웃.
// auth 변이는 services/auth만 경유(불변규칙 2). 상태 읽기는 useSession에서 파생.
// 시트 골격·필드·버튼 클래스(.sheet*, .field*, .btn-*)는 전역 CSS(AddBookSheet.css) 재사용.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../stores/useSession'
import { useAccountSheet } from '../../stores/useAccountSheet'
import { linkEmail, signInEmail, signOut } from '../../services/auth'
import './AccountSheet.css'

// supabase auth 에러를 사용자 문구로. 모르면 원문 노출(디버깅 가능하게).
function humanize(err) {
  const m = err?.message ?? ''
  if (/already.*registered|already.*exists/i.test(m))
    return '이미 가입된 이메일이에요. "로그인"으로 들어와 주세요.'
  if (/invalid login credentials/i.test(m))
    return '이메일 또는 비밀번호가 맞지 않아요.'
  if (/password should be at least/i.test(m))
    return '비밀번호는 6자 이상이어야 해요.'
  if (/unable to validate email|invalid format/i.test(m))
    return '이메일 형식을 확인해 주세요.'
  return m || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
}

export default function AccountSheet() {
  const closeSheet = useAccountSheet((s) => s.closeSheet)
  const user = useSession((s) => s.user)
  const navigate = useNavigate()

  const isLinked = !!user?.email // 확인 링크 클릭 후 email이 채워짐
  const pendingEmail = user?.new_email // 연동 요청했으나 미확인

  const [mode, setMode] = useState('link') // 'link' | 'signin' (익명 상태에서만)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [linkRequested, setLinkRequested] = useState(false)

  const showPending = !isLinked && (linkRequested || !!pendingEmail)

  async function onLink(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await linkEmail({ email: email.trim(), password })
      setLinkRequested(true) // "메일함 확인" 안내로 전환
    } catch (err) {
      setError(humanize(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSignIn(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInEmail({ email: email.trim(), password })
      closeSheet() // 세션 교체 → 단어장 등 자동 갱신
    } catch (err) {
      setError(humanize(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSignOut() {
    setError(null)
    setBusy(true)
    try {
      await signOut()
      closeSheet()
    } catch (err) {
      setError(humanize(err))
    } finally {
      setBusy(false)
    }
  }

  function openGuide() {
    closeSheet()
    navigate('/guide')
  }

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : closeSheet}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="계정"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <h2 className="sheet__title">계정</h2>
          <button
            type="button"
            className="sheet__close"
            onClick={closeSheet}
            disabled={busy}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="sheet__body">
          {isLinked ? (
            // ── 연동됨 ───────────────────────────────────
            <>
              <div className="account-status account-status--linked">
                <span className="account-status__dot" aria-hidden="true" />
                <div>
                  <p className="account-status__label">이메일 연동됨</p>
                  <p className="account-status__email">{user.email}</p>
                </div>
              </div>
              <p className="form__note">
                다른 기기에서 이 이메일로 로그인하면 단어장이 따라와요.
              </p>
              {error ? <p className="form__error">{error}</p> : null}
              <div className="sheet__actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onSignOut}
                  disabled={busy}
                >
                  {busy ? '처리 중…' : '로그아웃'}
                </button>
              </div>
            </>
          ) : showPending ? (
            // ── 연동 요청됨, 확인 메일 대기 ───────────────
            <>
              <div className="account-status">
                <span className="account-status__dot account-status__dot--wait" aria-hidden="true" />
                <div>
                  <p className="account-status__label">확인 메일을 보냈어요</p>
                  <p className="account-status__email">
                    {pendingEmail || email}
                  </p>
                </div>
              </div>
              <p className="form__note">
                메일함에서 <b>확인 링크</b>를 눌러주세요. 링크를 누르면 연동이
                완료돼요. (메일이 안 보이면 스팸함도 확인해 주세요.)
              </p>
              <div className="sheet__actions">
                <button type="button" className="btn-ghost" onClick={closeSheet}>
                  닫기
                </button>
              </div>
            </>
          ) : mode === 'link' ? (
            // ── 익명 · 이메일 연동 폼 ─────────────────────
            <form onSubmit={onLink} className="account-form">
              <div className="account-status">
                <span className="account-status__dot account-status__dot--anon" aria-hidden="true" />
                <div>
                  <p className="account-status__label">익명으로 사용 중</p>
                  <p className="account-status__hint">
                    이 기기에만 저장돼요. 이메일을 연동하면 기기가 바뀌어도
                    단어장을 안 잃어요.
                  </p>
                </div>
              </div>

              <label className="field">
                <span className="field__label">이메일</span>
                <input
                  className="field__input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">비밀번호 (6자 이상)</span>
                <input
                  className="field__input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="새 비밀번호"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>

              {error ? <p className="form__error">{error}</p> : null}

              <div className="sheet__actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !email.trim() || password.length < 6}
                >
                  {busy ? '보내는 중…' : '이메일 연동'}
                </button>
              </div>

              <button
                type="button"
                className="account-toggle"
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
              >
                이미 계정이 있어요? 로그인 →
              </button>
            </form>
          ) : (
            // ── 익명 · 기존 계정 로그인 폼 ────────────────
            <form onSubmit={onSignIn} className="account-form">
              <p className="form__warning">
                다른 기기 계정으로 로그인하면 <b>이 기기의 익명 단어장</b>은
                합쳐지지 않고 그 계정으로 전환돼요.
              </p>

              <label className="field">
                <span className="field__label">이메일</span>
                <input
                  className="field__input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">비밀번호</span>
                <input
                  className="field__input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error ? <p className="form__error">{error}</p> : null}

              <div className="sheet__actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !email.trim() || !password}
                >
                  {busy ? '로그인 중…' : '로그인'}
                </button>
              </div>

              <button
                type="button"
                className="account-toggle"
                onClick={() => {
                  setMode('link')
                  setError(null)
                }}
              >
                ← 이메일 연동으로 돌아가기
              </button>
            </form>
          )}

          {/* 공통: 가이드 다시 보기 (M8-A — 라우트는 다음 조각, 지금은 자리) */}
          <button type="button" className="account-guide-link" onClick={openGuide}>
            가이드 다시 보기
          </button>
        </div>
      </div>
    </div>
  )
}
