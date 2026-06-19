// KPI 한 장 — 라벨 + 큰 숫자. 통계 화면(대시보드·책별 상세) 공용 표시 조각.
// stats 폴더 안에서만 쓰므로 여기 둠(불변규칙 6).
export default function KpiCard({ label, value }) {
  return (
    <div className="kpi-card">
      <span className="kpi-card__value">{value}</span>
      <span className="kpi-card__label">{label}</span>
    </div>
  )
}
