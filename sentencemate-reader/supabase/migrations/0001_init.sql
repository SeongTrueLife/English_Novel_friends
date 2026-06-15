-- ============================================================
-- SentenceMate Reader — DB 초기 마이그레이션 (M1)
-- 정본: db/db_schema_v2.md (v2.1) — 이 파일은 그 SQL을 적용 가능한 순서로 모은 것.
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 순서: 확장 → 테이블 → 트리거 → 인덱스 → RLS (의존성 안전 순서)
-- ============================================================

-- ============================================
-- 0. 확장 (updated_at 자동 갱신용)
-- ============================================
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ============================================
-- 1. books (책 메타데이터, 글로벌 단일 행)
-- ============================================
CREATE TABLE public.books (
  book_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  book_hash text UNIQUE NOT NULL,
  source text NOT NULL CHECK (source IN ('user_upload', 'curated_free')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. user_books (users ↔ books N:M 중간 + 진척도)
-- ============================================
CREATE TABLE public.user_books (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  progress_cfi text,
  progress_pct numeric(4,1) CHECK (progress_pct BETWEEN 0 AND 100),
  added_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

-- ============================================
-- 3. cards (학습 카드: word + grammar 통합)
-- ============================================
CREATE TABLE public.cards (
  card_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('word', 'grammar')),

  -- word kind 전용
  word text,
  meaning text,
  thinking jsonb,

  -- grammar kind 전용
  pattern text,
  explanation text,
  interpretation_guide text,

  -- 공통
  example_sentence text NOT NULL,
  chapter text,

  -- SRS (word + grammar 둘 다 복습 대상)
  review_count integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  ease_factor numeric(3,2) NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- kind별 컬럼 강제 (도메인 무결성)
  CHECK (
    kind != 'word' OR (
      word IS NOT NULL
      AND meaning IS NOT NULL
      AND thinking IS NOT NULL
      AND pattern IS NULL
      AND explanation IS NULL
      AND interpretation_guide IS NULL
    )
  ),
  CHECK (
    kind != 'grammar' OR (
      pattern IS NOT NULL
      AND explanation IS NOT NULL
      AND interpretation_guide IS NOT NULL
      AND word IS NULL
      AND meaning IS NULL
      AND thinking IS NULL
    )
  )
);

-- ============================================
-- 4. sentences (인상 깊은 문장 컬렉션, UI는 다음 단계)
-- ============================================
CREATE TABLE public.sentences (
  sentence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  sentence text NOT NULL,
  note text,
  chapter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 5. reading_sessions (읽기 세션 풀 기록)
-- ============================================
CREATE TABLE public.reading_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  start_cfi text,
  end_cfi text,
  start_chapter text,
  end_chapter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (last_activity_at >= started_at)
);

-- ============================================
-- 6. ai_usage (일일 AI 호출 쿼터, v2.1 — service_role 전용)
-- ============================================
CREATE TABLE public.ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- ============================================
-- 7. updated_at 자동 갱신 트리거 (moddatetime)
-- ============================================
CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER sentences_set_updated_at
  BEFORE UPDATE ON public.sentences
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER user_books_set_updated_at
  BEFORE UPDATE ON public.user_books
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================
-- 8. 인덱스 (6개: 표준 4 + 부분 2)
-- ============================================
-- 라이브러리 화면: 사용자의 책 목록, 최근 연 순
CREATE INDEX user_books_user_last_opened_idx
  ON public.user_books (user_id, last_opened_at DESC NULLS LAST);

-- 단어장 화면: 사용자의 카드 목록 (책별 필터 + 최신순)
CREATE INDEX cards_user_book_created_idx
  ON public.cards (user_id, book_id, created_at DESC);

-- SRS 복습 (다음 단계): 복습 일정 잡힌 카드만 (부분 인덱스)
CREATE INDEX cards_user_review_idx
  ON public.cards (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- 문장 컬렉션 (다음 단계): cards와 동일 패턴
CREATE INDEX sentences_user_book_created_idx
  ON public.sentences (user_id, book_id, created_at DESC);

-- 세션 조회: 사용자의 최근 세션 (책별 옵션)
CREATE INDEX reading_sessions_user_book_started_idx
  ON public.reading_sessions (user_id, book_id, started_at DESC);

-- 미종료 세션 찾기: 다음 세션 시작 시 이전 미종료 세션 정리 (부분 인덱스)
CREATE INDEX reading_sessions_user_unended_idx
  ON public.reading_sessions (user_id)
  WHERE ended_at IS NULL;

-- ============================================
-- 9. RLS (6개 public 테이블 전부 enable)
-- ============================================

-- 9.1 books — 글로벌 읽기, 제한된 쓰기
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY books_select_all
  ON public.books FOR SELECT
  USING (true);

CREATE POLICY books_insert_authenticated
  ON public.books FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND source = 'user_upload'
  );
-- UPDATE/DELETE 정책 없음 → 누구도 못 함 (운영자는 service_role bypass)

-- 9.2 user_books — 본인만 모든 작업
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_books_select_own
  ON public.user_books FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY user_books_insert_own
  ON public.user_books FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_books_update_own
  ON public.user_books FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_books_delete_own
  ON public.user_books FOR DELETE
  USING (user_id = auth.uid());

-- 9.3 cards — 본인만 모든 작업
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_select_own
  ON public.cards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY cards_insert_own
  ON public.cards FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cards_update_own
  ON public.cards FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cards_delete_own
  ON public.cards FOR DELETE
  USING (user_id = auth.uid());

-- 9.4 sentences — 본인만 모든 작업
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;

CREATE POLICY sentences_select_own
  ON public.sentences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY sentences_insert_own
  ON public.sentences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY sentences_update_own
  ON public.sentences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY sentences_delete_own
  ON public.sentences FOR DELETE
  USING (user_id = auth.uid());

-- 9.5 reading_sessions — 본인만 모든 작업
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reading_sessions_select_own
  ON public.reading_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY reading_sessions_insert_own
  ON public.reading_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reading_sessions_update_own
  ON public.reading_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reading_sessions_delete_own
  ON public.reading_sessions FOR DELETE
  USING (user_id = auth.uid());

-- 9.6 ai_usage — service_role 전용 (정책 없음 = 클라 전면 차단)
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- 사용자 정책 없음. Edge Function이 service_role key로만 접근.

-- ============================================
-- 끝. 검증 쿼리는 0001_verify.sql 참조.
-- ============================================
