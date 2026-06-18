import { Fragment } from 'react'

// 인라인 마크다운 (§6.2 파싱 2겹) — 외부 lib·dangerouslySetInnerHTML 없이 React 노드로.
// 지원: **굵게**(= 설명 중인 영어 조각 → .md-em 밑줄/강조), \n 줄바꿈. 그 외는 그대로.
// JSON.parse가 \n을 실제 개행으로 풀어주므로 split('\n')으로 줄 분리.
export default function Markdown({ text }) {
  if (!text) return null
  const lines = String(text).split('\n')
  return lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*.+?\*\*)/g).map((tok, ti) => {
        const m = /^\*\*(.+)\*\*$/.exec(tok)
        return m ? (
          <strong key={ti} className="md-em">
            {m[1]}
          </strong>
        ) : (
          <Fragment key={ti}>{tok}</Fragment>
        )
      })}
    </Fragment>
  ))
}
