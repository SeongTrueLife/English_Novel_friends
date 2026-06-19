// 설정 시트 (§6.2) — "별도 설정 화면 없이 이 시트가 설정 진입구".
// ⚠️ 조각 A에선 자리(placeholder)만. 글자 크기 ± / 테마(라이트·다크) 컨트롤 UI는 다음 조각에서:
//   · 글자 크기 = 조각 B (useSettings.fontSize → themes.fontSize + 재flow 후 CFI 복원)
//   · 다크모드 = 조각 C (useSettings.theme → tokens.css 다크 세트 + epub iframe 동기화)
// useSettings store는 이미 신설(그릇 준비됨). 여기선 아직 연결하지 않는다.
import Sheet from '../../components/ui/Sheet'
import './SettingsSheet.css'

export default function SettingsSheet({ onClose }) {
  return (
    <Sheet title="설정" onClose={onClose}>
      <p className="settings-sheet__placeholder">
        글자 크기와 테마(라이트·다크) 설정이 곧 추가됩니다.
      </p>
    </Sheet>
  )
}
