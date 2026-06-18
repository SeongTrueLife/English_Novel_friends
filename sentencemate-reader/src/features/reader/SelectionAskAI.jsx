// 선택한 문장 위에 떠오르는 "Ask AI" 작은 버튼 (v1 AskAIButton 이식).
// rect는 뷰포트 좌표 → position:fixed로 선택 위 가운데. 화면 밖으로 안 나가게 left clamp.
// onMouseDown preventDefault: 버튼 누를 때 본문 선택이 풀리지 않게.
// className 'selection-askai'는 useTextSelection의 바깥-클릭 해제 가드와 일치(버튼 클릭 시 해제 안 됨).

const BTN_HALF = 44 // 대략 버튼 절반 폭(px) — 좌우 clamp 여백용
const GAP = 8 // 선택과 버튼 사이 간격

export default function SelectionAskAI({ rect, onAskAI }) {
  if (!rect) return null

  const top = Math.max(GAP, rect.top - GAP) // 선택 윗변 살짝 위
  const left = Math.min(
    window.innerWidth - BTN_HALF,
    Math.max(BTN_HALF, rect.left + rect.width / 2),
  )

  return (
    <button
      type="button"
      className="selection-askai"
      style={{ top, left, transform: 'translate(-50%, -100%)' }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAskAI}
      aria-label="선택한 문장 AI 설명 요청"
    >
      Ask AI
    </button>
  )
}
