// 라이브러리·책추가 데이터 접근 계층 (backend_design ③).
// 컴포넌트는 이 파일을 통해서만 books/user_books에 접근(불변규칙 2). 실패 시 throw(규칙 1).
// user_id는 인자로 안 받음 — RLS(auth.uid())가 격리, INSERT만 getUser로 채움.
import { supabase } from '../lib/supabase'

// 같은 책 자동매칭(book_hash 트릭). books엔 RLS UPDATE 정책이 없어 upsert(DO UPDATE) 불가 →
// SELECT-then-INSERT. 충돌(타인이 올린 같은 책)도 SELECT는 누구나라 찾힘 = 트릭 성립.
export async function upsertBookByHash({ title, author, bookHash }) {
  // ① 이미 있으면 그 행 재사용 (books SELECT 정책: USING(true) → 타인 행도 보임)
  const found = await selectBookIdByHash(bookHash)
  if (found) return found

  // ② 없으면 INSERT (RLS INSERT: source='user_upload'만 허용)
  const { data, error } = await supabase
    .from('books')
    .insert({ title, author, book_hash: bookHash, source: 'user_upload' })
    .select('book_id')
    .single()

  // ③ 경쟁상태: 두 단말기가 같은 새 책 동시 업로드 → 한쪽 UNIQUE 위반(23505).
  //    그 사이 다른 쪽이 만든 행을 다시 조회해 반환(어떤 경우든 안전).
  if (error) {
    if (error.code === '23505') {
      const raced = await selectBookIdByHash(bookHash)
      if (raced) return raced
    }
    throw error
  }
  return data.book_id
}

// book_hash로 기존 book_id 조회. 없으면 null. (upsertBookByHash 내부 전용)
async function selectBookIdByHash(bookHash) {
  const { data, error } = await supabase
    .from('books')
    .select('book_id')
    .eq('book_hash', bookHash)
    .maybeSingle() // 0행 → data null (에러 아님), 1행 → 그 행
  if (error) throw error
  return data?.book_id ?? null
}

// 단건 책 메타 조회(리더가 URL의 bookId만 받으므로 source/title을 따로 읽는다).
// books SELECT 정책 USING(true) → 어떤 book_id든 조회 가능. 없으면 null(maybeSingle).
export async function getBook(bookId) {
  const { data, error } = await supabase
    .from('books')
    .select('book_id, title, author, source')
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data // { book_id, title, author, source } | null
}

// 책을 내 라이브러리에 추가(user_books INSERT). user_id는 getUser로 채움(RLS WITH CHECK 통과).
// 이미 있으면 무해 — ON CONFLICT DO NOTHING(ignoreDuplicates). user_books엔 INSERT 정책 있음.
export async function addToLibrary(bookId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('인증 세션 없음 — 라이브러리에 추가할 수 없습니다.')

  const { error } = await supabase.from('user_books').upsert(
    { user_id: user.id, book_id: bookId },
    { onConflict: 'user_id,book_id', ignoreDuplicates: true }, // DO NOTHING → UPDATE 안 탐
  )
  if (error) throw error
}

// 내 라이브러리 목록 + 책 메타데이터(관계 조인), 최근 연 순(NULLS LAST). RLS가 본인 행만.
export async function getLibrary() {
  const { data, error } = await supabase
    .from('user_books')
    .select('*, books(*)') // user_books 행에 books(*) 중첩
    .order('last_opened_at', { ascending: false, nullsFirst: false }) // 인덱스 ...last_opened DESC NULLS LAST 정합
  if (error) throw error
  return data
}

// 라이브러리에서 책 빼기(user_books DELETE). cards/sentences는 books 직접 참조라 보존(결정 7).
// RLS가 user_id 격리 → 본인 행만 지워짐.
export async function removeFromLibrary(bookId) {
  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('book_id', bookId)
  if (error) throw error
}

// 읽기 진척도 갱신. updated_at은 moddatetime 트리거가 자동 → 여기선 안 넣음.
// pct는 null/undefined면 키 자체를 생략 → 직전 값 보존(epubjs locations 준비 전 CFI-only 저장이
//   pct를 NULL로 덮어쓰지 않게). cfi·last_opened_at은 항상 갱신.
export async function updateProgress(bookId, { cfi, pct }) {
  const patch = {
    progress_cfi: cfi,
    last_opened_at: new Date().toISOString(),
  }
  if (pct != null) patch.progress_pct = pct
  const { error } = await supabase
    .from('user_books')
    .update(patch)
    .eq('book_id', bookId)
  if (error) throw error
}

// 이어 읽기용 진척 조회(이 책 user_books 행). RLS가 본인 행만 → book_id만으로 단건.
export async function getReadingProgress(bookId) {
  const { data, error } = await supabase
    .from('user_books')
    .select('progress_cfi, progress_pct')
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data // { progress_cfi, progress_pct } | null
}
