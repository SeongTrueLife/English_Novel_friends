// 학습 카드(word/grammar) 데이터 접근 계층 (backend_design ③).
// 컴포넌트는 이 파일을 통해서만 cards에 접근(불변규칙 2). 실패 시 throw(규칙 1).
// example_sentence(=[Selected] 원문)는 AI 응답이 아니라 클라가 들고 있다가 저장 시 첨부(규칙 5).
// user_id는 인자로 안 받음 — RLS(auth.uid())가 SELECT/DELETE를 격리, INSERT만 getUser로 채움.
import { supabase } from '../lib/supabase'

// 인증된 user 반환 — 두 save 함수가 user_id 채울 때 공용. books.js addToLibrary와 동일 패턴.
async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('인증 세션 없음 — 카드를 저장할 수 없습니다.')
  return user
}

// 단어 카드 저장. kind='word'로 INSERT.
// grammar 전용 컬럼(pattern/explanation/interpretation_guide)은 키 자체를 생략 → NULL → word CHECK 통과.
// SRS 컬럼은 안 넣음 → DB DEFAULT(review_count 0, ease_factor 2.5, interval_days 0)에 위임.
export async function saveWordCard({
  bookId,
  word,
  meaning,
  thinking,
  exampleSentence,
  chapter,
}) {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('cards')
    .insert({
      user_id: user.id,
      book_id: bookId,
      kind: 'word',
      word,
      meaning,
      thinking: thinking ?? [], // NOT NULL(word CHECK) → 없으면 빈 배열. supabase-js가 jsonb로 직렬화.
      example_sentence: exampleSentence, // 규칙 5: 클라가 들고 있던 [Selected] 원문
      chapter, // 없으면 undefined → NULL (chapter는 nullable)
    })
    .select()
    .single()
  if (error) throw error
  return data // 저장된 카드 행(낙관적 업데이트 캐시·card_id용)
}

// 문법 카드 저장. kind='grammar'로 INSERT.
// word 전용 컬럼(word/meaning/thinking)은 키 자체를 생략 → NULL → grammar CHECK 통과.
export async function saveGrammarCard({
  bookId,
  pattern,
  explanation,
  interpretationGuide,
  exampleSentence,
  chapter,
}) {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('cards')
    .insert({
      user_id: user.id,
      book_id: bookId,
      kind: 'grammar',
      pattern,
      explanation,
      interpretation_guide: interpretationGuide,
      example_sentence: exampleSentence, // 규칙 5
      chapter,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// 카드 목록 조회. 옵션 필터(book_id/kind), created_at 최신순. RLS cards_select_own이 본인 행만 격리.
// 인덱스 cards_user_book_created_idx (user_id, book_id, created_at DESC)와 정합.
export async function getCards({ bookId, kind } = {}) {
  // books(title, author) 관계 조인 — 단어장이 책 제목으로 그룹핑. books RLS SELECT는 USING(true)라 조인 OK.
  let query = supabase.from('cards').select('*, books(title, author)')
  if (bookId) query = query.eq('book_id', bookId)
  if (kind) query = query.eq('kind', kind)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return data
}

// 카드 한 건 삭제. RLS cards_delete_own이 본인 행만 삭제(cards는 leaf — FK 참조 없음).
export async function deleteCard(cardId) {
  const { error } = await supabase.from('cards').delete().eq('card_id', cardId)
  if (error) throw error
}
