// 설정 시트 (§6.2) — "별도 설정 화면 없이 이 시트가 설정 진입구".
// 조각 B: 글자 크기 컨트롤(A− / 현재값 / A+) → useSettings.fontSize/setFontSize.
// 조각 C: 테마(라이트/다크) 세그먼트 토글 → useSettings.theme/setTheme.
//   적용은 useReader(본문)·App.jsx(앱셸 data-theme)가 store를 구독해 처리(설계 D1·D3).
import Sheet from '../../components/ui/Sheet'
import { useSettings } from '../../stores/useSettings'
import './SettingsSheet.css'

// 글자 크기 범위(§6.2 measure ~680px 세리프 본문 기준): 14~28px, 2px 단계.
const FONT_MIN = 14
const FONT_MAX = 28
const FONT_STEP = 2

const THEMES = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

export default function SettingsSheet({ onClose }) {
  const fontSize = useSettings((s) => s.fontSize)
  const setFontSize = useSettings((s) => s.setFontSize)
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)

  const dec = () => setFontSize(Math.max(FONT_MIN, fontSize - FONT_STEP))
  const inc = () => setFontSize(Math.min(FONT_MAX, fontSize + FONT_STEP))

  return (
    <Sheet title="설정" onClose={onClose}>
      <div className="settings-row">
        <span className="settings-row__label">글자 크기</span>
        <div className="settings-stepper">
          <button
            type="button"
            className="settings-stepper__btn"
            onClick={dec}
            disabled={fontSize <= FONT_MIN}
            aria-label="글자 작게"
          >
            A−
          </button>
          <span className="settings-stepper__value" aria-live="polite">
            {fontSize}px
          </span>
          <button
            type="button"
            className="settings-stepper__btn"
            onClick={inc}
            disabled={fontSize >= FONT_MAX}
            aria-label="글자 크게"
          >
            A+
          </button>
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-row__label">테마</span>
        <div className="settings-segment" role="group" aria-label="테마">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={
                theme === t.value
                  ? 'settings-segment__btn settings-segment__btn--active'
                  : 'settings-segment__btn'
              }
              onClick={() => setTheme(t.value)}
              aria-pressed={theme === t.value}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
