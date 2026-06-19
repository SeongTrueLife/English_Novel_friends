// 설명/가이드 페이지 (frontend_plan §6.9) — /guide, AppShell 안(탭바 보임).
// 처음 본 사용자가 앱 정체성·핵심 루프·메뉴·이메일 연동을 이해하게 돕는 정적 페이지.
// 데이터/서비스 접근 없음 — localStorage('guideSeen')와 기존 useAccountSheet만 사용(불변규칙 2·3).
// 첫 실행 1회 자동 노출 게이트는 App.jsx에 있다. "가이드 다시 보기"(AccountSheet)로 재진입.
import { useNavigate } from 'react-router-dom'
import { useAccountSheet } from '../../stores/useAccountSheet'
import './GuidePage.css'

// 핵심 루프 5단계 (§6.9 ②). 스크린샷은 placeholder — 사용자가 나중에 교체.
const STEPS = [
  { icon: '📖', title: '책을 연다', body: '서재에서 epub을 열어 읽어요.' },
  { icon: '✍️', title: '문장을 선택', body: '막히는 문장을 드래그하면 “Ask AI” 버튼이 떠요.' },
  {
    icon: '🤖',
    title: '4축 풀이',
    body: '단어 · 문법 · 생각(추론 단서) · 자연스러운 해석 — 정답을 던지지 않고 단서로 풀어줘요.',
  },
  { icon: '⊕', title: '카드로 저장', body: '마음에 드는 풀이를 ⊕로 단어장에 담아요(원문 예문도 함께).' },
  { icon: '🔁', title: '복습', body: '단어장 · 플래시카드로 모은 카드를 다시 봐요.' },
]

// 탭바 메뉴 안내 (§6.9 ③).
const MENUS = [
  { icon: '📚', name: '서재', body: '내 책 목록. ＋로 epub 추가, 탭하면 읽기(진행 위치 자동 저장).' },
  { icon: '🗂️', name: '단어장', body: '모은 카드(단어/문법). 펼쳐 보기, 선택해서 학습·삭제, “학습 시작”으로 플래시카드.' },
  { icon: '📊', name: '통계', body: '모은 단어·문법 수와 책별 진척률.' },
  { icon: '👤', name: '계정', body: '익명/연동 상태. 이메일 연동·로그인.' },
]

export default function GuidePage() {
  const navigate = useNavigate()
  const openSheet = useAccountSheet((s) => s.openSheet)

  function start() {
    localStorage.setItem('guideSeen', 'true')
    navigate('/library')
  }

  return (
    <main className="screen guide">
      {/* ① 정체성 */}
      <header className="guide__hero">
        <h1 className="guide__title">추론으로 읽는 영어 원서 리더</h1>
        <p className="guide__lead">
          모르는 문장을 바로 번역해 주는 대신, 단어·문법·맥락을 단서로{' '}
          <b>스스로 뜻을 추론하게</b> 돕고, 그 과정을 카드로 모아 복습해요.
        </p>
      </header>

      {/* ② 핵심 루프 */}
      <section className="guide-section">
        <h2 className="guide-section__title">이렇게 써요</h2>
        <ol className="guide-steps">
          {STEPS.map((s, i) => (
            <li key={i} className="guide-step">
              <span className="guide-step__icon" aria-hidden="true">
                {s.icon}
              </span>
              <div className="guide-step__text">
                <p className="guide-step__title">
                  {i + 1}. {s.title}
                </p>
                <p className="guide-step__body">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {/* 스크린샷 자리 — 사용자가 나중에 교체 */}
        <div className="guide-shot" aria-hidden="true">
          <span className="guide-shot__cap">스크린샷</span>
        </div>
      </section>

      {/* ③ 메뉴 안내 */}
      <section className="guide-section">
        <h2 className="guide-section__title">화면 안내</h2>
        <ul className="guide-menus">
          {MENUS.map((m) => (
            <li key={m.name} className="guide-menu">
              <span className="guide-menu__icon" aria-hidden="true">
                {m.icon}
              </span>
              <p className="guide-menu__text">
                <b className="guide-menu__name">{m.name}</b> — {m.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ④ 이메일 연동 안내 */}
      <section className="guide-link">
        <h2 className="guide-link__title">단어장을 안 잃으려면</h2>
        <p className="guide-link__body">
          지금은 <b>익명</b>으로, 이 기기에만 저장돼요. <b>이메일을 연동하면 다른
          기기에서도</b> 단어장을 쓰고, 연동 안 한 채 <b>브라우저 캐시(사이트
          데이터)를 지우면 단어장이 사라질 수 있어요</b>(익명 계정의 한계).
        </p>
        <button type="button" className="btn-ghost" onClick={openSheet}>
          이메일 연동하기
        </button>
      </section>

      <div className="guide-start">
        <button type="button" className="btn-primary" onClick={start}>
          시작하기
        </button>
      </div>
    </main>
  )
}
