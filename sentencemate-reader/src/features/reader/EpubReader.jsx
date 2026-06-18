// 리더 화면 — /read/:bookId. epub.js로 책을 열어 읽고 쪽을 넘기고 '←'로 나간다.
// 이 라우트에서 AppShell이 탭바를 숨긴다(몰입). 컨트롤은 현재 '나가기'만(§6.2).
// 문장 선택 → Ask AI → AIResponse 시트(M4 완료). CFI 저장·TOC·설정·진척은 M6.
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBook } from './useBook'
import { useReader } from './useReader'
import { useTextSelection } from './useTextSelection'
import { useAskAI } from './useAskAI'
import SelectionAskAI from './SelectionAskAI'
import AIResponse from './AIResponse'
import './EpubReader.css'

export default function EpubReader() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const viewerRef = useRef(null)
  const [showControls, setShowControls] = useState(false)

  const { data: book, isPending, isError } = useBook(bookId)
  const { status, rendition, prev, next } = useReader(viewerRef, book, {
    onCenterTap: () => setShowControls((v) => !v),
  })
  const { selected, prev: ctxPrev, next: ctxNext, rect, clear } =
    useTextSelection(rendition)

  // AI 풀이: 호출은 useMutation(askAI), 시트 열림+앵커 문장은 로컬 state.
  // 선택은 clear()로 사라지므로 호출 시점의 selected를 스냅샷해 앵커로 쓴다.
  const askAi = useAskAI()
  const [askedSentence, setAskedSentence] = useState(null) // null=닫힘 / string=열림

  // 선택 → AI payload 조립(system_prompt_v3 / backend_design ③ 계약) → 호출 + 시트 열기.
  // 배열 순서 계약: prev=[Previous 2, Previous 1], next=[Next 1, Next 2] (서버 buildUserMessage와 일치).
  const handleAskAI = () => {
    setAskedSentence(selected)
    askAi.mutate({
      bookInfo: { title: book?.title ?? '', author: book?.author ?? '' },
      prev: ctxPrev,
      selected,
      next: ctxNext,
    })
    clear()
  }

  const closeSheet = () => {
    setAskedSentence(null)
    askAi.reset()
  }
  const retryAskAI = () => askAi.mutate(askAi.variables) // 마지막 payload 재호출

  // 키보드 좌우 화살표 쪽넘김
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [prev, next])

  const goLibrary = () => navigate('/library')

  // 책 메타 조회 실패 / 없는 책
  if (isError || (!isPending && !book)) {
    return <ReaderMessage text="책을 불러오지 못했어요." onBack={goLibrary} />
  }

  // 이 단말기에 파일 없음(다른 단말기에서 업로드) — backend_design ④
  if (status === 'missing') {
    return (
      <ReaderMessage
        text="이 단말기엔 파일이 없어요. epub을 다시 올려주세요."
        onBack={goLibrary}
      />
    )
  }

  return (
    <div className="reader">
      {showControls && (
        <div className="reader__topbar">
          <button
            type="button"
            className="reader__back"
            onClick={goLibrary}
            aria-label="서재로 나가기"
          >
            ←
          </button>
          <span className="reader__title">{book?.title ?? ''}</span>
          <span className="reader__topbar-spacer" aria-hidden="true" />
        </div>
      )}

      <div className="reader__body">
        <div ref={viewerRef} className="reader__viewer" />
      </div>

      {selected && rect && <SelectionAskAI rect={rect} onAskAI={handleAskAI} />}

      {askedSentence != null && (
        <AIResponse
          sentence={askedSentence}
          mutation={askAi}
          onRetry={retryAskAI}
          onClose={closeSheet}
        />
      )}

      {(isPending || status === 'loading') && (
        <div className="reader__loading">불러오는 중…</div>
      )}
      {status === 'error' && (
        <ReaderMessage
          text="책을 여는 중 문제가 생겼어요."
          onBack={goLibrary}
          overlay
        />
      )}
    </div>
  )
}

// 전체화면(또는 오버레이) 안내 + 서재로 버튼. 리더가 막혔을 때 '책에 갇힘' 방지(§6.2).
function ReaderMessage({ text, onBack, overlay }) {
  return (
    <div className={overlay ? 'reader__message reader__message--overlay' : 'reader__message'}>
      <p className="reader__message-text">{text}</p>
      <button type="button" className="reader__message-back" onClick={onBack}>
        ← 서재로
      </button>
    </div>
  )
}
