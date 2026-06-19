// 목차(TOC) 시트 (§6.2) — 챕터 탭 → 점프. 현재 챕터 강조.
// epubjs navigation.toc를 평탄화(중첩 subitems)해 목록으로. 데이터 형태는 useReadingSession과 동일(t.href/t.label).
// 점프: rendition.display(href) → 시트 닫기. book은 status 'ready'면 이미 navigation 로드 완료.
import Sheet from '../../components/ui/Sheet'
import './TocSheet.css'

// navigation.toc(중첩 트리)를 { label, href, depth } 평탄 배열로. epubjs 중첩 키는 subitems.
function flattenToc(items, depth = 0, out = []) {
  if (!Array.isArray(items)) return out
  for (const item of items) {
    if (item?.href && item?.label) {
      out.push({ label: item.label.trim(), href: item.href, depth })
    }
    if (item?.subitems?.length) flattenToc(item.subitems, depth + 1, out)
  }
  return out
}

export default function TocSheet({ rendition, currentChapter, onClose }) {
  const toc = flattenToc(rendition?.book?.navigation?.toc)

  const jump = (href) => {
    rendition?.display(href)
    onClose()
  }

  return (
    <Sheet title="목차" onClose={onClose}>
      {toc.length === 0 ? (
        <p className="toc-sheet__empty">목차 정보가 없어요.</p>
      ) : (
        <ul className="toc-sheet__list">
          {toc.map((item, i) => {
            const isCurrent =
              currentChapter && item.label === currentChapter.trim()
            return (
              <li key={i}>
                <button
                  type="button"
                  className={
                    isCurrent ? 'toc-sheet__item toc-sheet__item--current' : 'toc-sheet__item'
                  }
                  style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                  onClick={() => jump(item.href)}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
