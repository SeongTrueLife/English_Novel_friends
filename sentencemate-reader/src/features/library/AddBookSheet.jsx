// 책 추가 오버레이 (frontend_plan §6.5, 3스텝). 라우트가 아니라 BookLibrary가 여닫는 곁일(arch ①).
// 데이터 접근은 services/books + lib(hashEpub/saveEpub)만 경유(불변규칙 2). 저장은 useMutation(throw→error 자동).
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import ePub from 'epubjs'
import { hashEpub } from '../../lib/bookHash'
import { saveEpub } from '../../lib/indexeddb'
import { upsertBookByHash, addToLibrary } from '../../services/books'
import './AddBookSheet.css'

const EPUB_RE = /\.epub$/i

export default function AddBookSheet({ onClose }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [parseWarning, setParseWarning] = useState(null) // 파일명 추측 경고
  const [fileError, setFileError] = useState(null) // 비-epub/깨짐 (① 단계)

  // ① 파일 선택 → epubjs로 메타 파싱 → ② 폼.
  async function onPick(e) {
    const f = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 허용
    if (!f) return
    if (!EPUB_RE.test(f.name)) {
      setFileError('epub 파일만 올릴 수 있어요.')
      return
    }
    setFileError(null)
    const guess = f.name.replace(EPUB_RE, '')
    try {
      const book = ePub(await f.arrayBuffer(), { openAs: 'binary' })
      const meta = await book.loaded.metadata
      book.destroy()
      const parsedTitle = meta?.title?.trim()
      setTitle(parsedTitle || guess)
      setAuthor(meta?.creator?.trim() || '')
      setParseWarning(
        parsedTitle
          ? null
          : '파일에서 정보를 못 읽어 파일명으로 채웠어요. 확인해 주세요.',
      )
      setFile(f) // 폼 단계로
    } catch {
      // 깨짐/비정상 epub → ① 단계에 머무름
      setFileError('이 파일을 열 수 없어요. epub이 맞는지 확인해 주세요.')
    }
  }

  // ③ 저장: hash → upsert(book_id) → IndexedDB → 라이브러리. 성공 시 서재 갱신 + 닫기.
  const save = useMutation({
    mutationFn: async () => {
      const bookHash = await hashEpub(file)
      const bookId = await upsertBookByHash({
        title: title.trim(),
        author: author.trim(),
        bookHash,
      })
      await saveEpub(bookId, file) // IndexedDB: book_id 키 (backend_design ④)
      await addToLibrary(bookId)
      return bookId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      onClose()
    },
  })

  function onSubmit(e) {
    e.preventDefault()
    if (!title.trim() || save.isPending) return
    save.mutate()
  }

  return (
    <div
      className="sheet-backdrop"
      onClick={save.isPending ? undefined : onClose}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="책 추가"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <h2 className="sheet__title">책 추가</h2>
          <button
            type="button"
            className="sheet__close"
            onClick={onClose}
            disabled={save.isPending}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        {!file ? (
          // ── ① 파일 선택 ───────────────────────────────
          <div className="sheet__body">
            <label className="filepick">
              <input
                type="file"
                accept=".epub,application/epub+zip"
                onChange={onPick}
                className="filepick__input"
              />
              <span className="filepick__plus" aria-hidden="true">
                ＋
              </span>
              <span className="filepick__label">epub 파일 선택</span>
              <span className="filepick__hint">epub 형식만 지원해요</span>
            </label>
            {fileError ? <p className="form__error">{fileError}</p> : null}
          </div>
        ) : (
          // ── ② 정보 확인/수정 + ③ 저장 ─────────────────
          <form className="sheet__body" onSubmit={onSubmit}>
            {parseWarning ? (
              <p className="form__warning">{parseWarning}</p>
            ) : null}

            <label className="field">
              <span className="field__label">제목 *</span>
              <input
                className="field__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="책 제목"
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field__label">작가</span>
              <input
                className="field__input"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="(선택)"
              />
            </label>

            <p className="form__note">
              이미 가진 책이면 기존 진행·단어장이 자동으로 연결돼요.
            </p>

            {save.isError ? (
              <p className="form__error">
                저장에 실패했어요. 다시 시도해 주세요.
              </p>
            ) : null}

            <div className="sheet__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={onClose}
                disabled={save.isPending}
              >
                취소
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!title.trim() || save.isPending}
              >
                {save.isPending ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
