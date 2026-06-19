// 설정 시트 (§6.2) — "별도 설정 화면 없이 이 시트가 설정 진입구".
// 조각 B: 글자 크기 컨트롤(A− / 현재값 / A+) → useSettings.fontSize/setFontSize 연결.
//   적용·위치 유지(re-flow 후 CFI 복원)는 useReader가 fontSize를 구독해 처리(조각 B 설계 D1).
// 테마(라이트·다크) 컨트롤은 다음 조각 C에서 이 시트에 추가.
import Sheet from '../../components/ui/Sheet'
import { useSettings } from '../../stores/useSettings'
import './SettingsSheet.css'

// 글자 크기 범위(§6.2 measure ~680px 세리프 본문 기준): 14~28px, 2px 단계.
const FONT_MIN = 14
const FONT_MAX = 28
const FONT_STEP = 2

export default function SettingsSheet({ onClose }) {
  const fontSize = useSettings((s) => s.fontSize)
  const setFontSize = useSettings((s) => s.setFontSize)

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
    </Sheet>
  )
}
