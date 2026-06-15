-- ============================================================
-- M1 검증 쿼리 — 0001_init.sql 적용 후 SQL Editor에서 하나씩 실행해 확인.
-- (db_schema_v2.md "RLS 테스트 체크리스트" 일부를 쿼리로 구현)
-- ============================================================

-- [1] 6개 테이블이 모두 만들어졌고 RLS가 켜졌는가?
--     기대: 6행 모두 rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('books','user_books','cards','sentences','reading_sessions','ai_usage')
ORDER BY tablename;

-- [2] 테이블별 정책 개수가 의도대로인가?
--     기대: books=2, user_books=4, cards=4, sentences=4, reading_sessions=4, ai_usage=0
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- [3] 정책 상세(이름·동작·USING/WITH CHECK) 눈으로 확인
SELECT tablename, policyname, cmd,
       qual        AS using_expr,
       with_check  AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- [4] updated_at 트리거 3개가 걸렸는가?
--     기대: cards / sentences / user_books 각각 1행
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY table_name;

-- [5] 인덱스 6개가 만들어졌는가? (PK/UNIQUE 자동 인덱스 제외, 우리가 만든 _idx만)
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%\_idx'
ORDER BY tablename, indexname;

-- [6] cards CHECK 제약 빠른 점검(선택): word인데 pattern 채우면 실패해야 정상.
--     아래는 일부러 실패해야 하는 쿼리 — 에러(violates check constraint)가 나면 무결성 OK.
--     ※ book_id가 없으니 실제론 FK에서 먼저 막힐 수 있음. CHECK 동작은 M2에서 실데이터로 확인해도 됨.
-- INSERT INTO public.cards (user_id, book_id, kind, word, pattern, example_sentence)
-- VALUES (auth.uid(), gen_random_uuid(), 'word', '단어', '틀린패턴', '예문');
