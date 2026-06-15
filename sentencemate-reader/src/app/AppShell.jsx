// 앱 셸 — 화면 공통 껍데기(탭바 nav) + <Outlet/>으로 현재 라우트 화면을 끼운다.
// arch ①: 리더(/read/*)에서는 몰입을 위해 셸(탭바)을 숨긴다.
// M0은 단일 하단 탭바. "세로 탭바 ↔ 가로 레일" 반응형 전환은 후속 M의 폴리시.
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/library', label: '서재' },
  { to: '/vocab', label: '단어장' },
  { to: '/stats', label: '통계' },
]

export default function AppShell() {
  const { pathname } = useLocation()
  const hideShell = pathname.startsWith('/read')

  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>

      {!hideShell && (
        <nav className="tab-bar">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                isActive ? 'tab tab--active' : 'tab'
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
