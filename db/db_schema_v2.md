# DB Schema v2 — SentenceMate Reader

작성: 2026-06-01 (시스템 프롬프트 v3 + 컬럼 설계 반영)
관련 문서:
- [../plan_v2_26_05_24.md](../plan_v2_26_05_24.md) — v2 전반 결정사항
- [../system_prompt_v3_draft.md](../system_prompt_v3_draft.md) — AI 응답 구조 v3 (이 스키마의 출발점)
- [db_learning_notes.md](db_learning_notes.md) — DB 개념 일반론

> **사용자 메모**: plan_v2와의 합치기는 사용자가 직접 처리 예정. 이 파일은 그 전까지 독립적으로 유지. 파일 하단의 "plan_v2와의 관계" 표가 합치기 가이드.

---

## 백엔드 환경

| 항목 | 결정 |
|---|---|
| DB | Supabase (PostgreSQL 기반 BaaS) |
| 인증 | 익명 인증(Anonymous Auth) → 추후 이메일/Google OAuth 업그레이드 |
| 사용자 테이블 | **`auth.users` (Supabase 관리) 직접 참조** — 별도 `public.users` 만들지 않음 |
| 비용 예상 (100명 규모) | Free tier 안에 충분 (DB ~170MB / Storage ~300MB / Bandwidth 2~3GB) |
| 스토리지 정책 | 하이브리드: 저작권 free 책 + 모든 메타데이터 → Supabase / 사용자 epub 파일 → IndexedDB |

---

## 엔티티 목록 (v2 확정)

| 엔티티 | 역할 |
|---|---|
| **auth.users** (Supabase 관리) | 사용자 (익명 + 이메일 연동 모두 포함). id, email, is_anonymous, created_at 기본 제공 |
| **books** | 책 메타데이터 (글로벌 단일 행, book_hash로 같은 책 식별) |
| **user_books** | "어떤 user가 어떤 book을 라이브러리에 가졌는가" + 읽기 진척도. users ↔ books N:M 중간 테이블 |
| **cards** | 학습 카드. kind: `word` \| `grammar` 통합. word kind는 thinking을 JSONB로 보유 |
| **sentences** | 인상 깊은 문장 컬렉션 (학습 단위 아님, 보관용). 데이터 모델만 v2, UI는 v3 |
| **reading_sessions** | 읽기 세션 기록 (시작/종료/CFI 위치/챕터/마지막 활동 시각) |

### 제외된 엔티티

| 후보 | 제외 사유 |
|---|---|
| ~~public.users~~ | auth.users 직접 사용. 추가 컬럼 필요해지면 그때 profiles 테이블 추가 |
| ~~study_stats~~ | derived data — 쿼리로 집계. 별도 테이블은 동기화 문제 유발 |
| ~~card_thinking 별도 테이블~~ | cards.thinking JSONB로 통째 저장 (강의 4 모델 D 적용) |

### 제외된 컬럼

| 후보 컬럼 | 제외 사유 |
|---|---|
| ~~reading_sessions.cards_added_count~~ | cards 테이블의 created_at으로 계산 가능. 분석 빈도 낮을 듯하니 컬럼 부담 회피 |

---

## ERD

```
┌──────────────────┐
│   auth.users     │  ← Supabase 관리
├──────────────────┤
│ 🔑 id (uuid)     │
│    email         │   ← NULL 가능 (익명 사용자)
│    is_anonymous  │
│    created_at    │
└──────────────────┘
        │
        │ 1
        │
        ├────────────────────┬────────────────────┬────────────────────┬────────────────────┐
        │                    │                    │                    │                    │
        │ N                  │ N                  │ N                  │ N                  │
        │                    │                    │                    │                    │
┌──────────────┐  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────────┐
│ user_books   │  │      cards       │  │   sentences    │  │  reading_sessions    │
├──────────────┤  ├──────────────────┤  ├────────────────┤  ├──────────────────────┤
│ 🔑(user_id,  │  │ 🔑 card_id       │  │ 🔑 sentence_id │  │ 🔑 session_id        │
│   book_id)   │  │  * user_id (FK)  │  │  * user_id(FK) │  │  * user_id (FK)      │
│ progress_cfi │  │  * book_id (FK)  │  │  * book_id(FK) │  │  * book_id (FK)      │
│ progress_pct │  │    kind          │  │    sentence    │  │    started_at        │
│ added_at     │  │    [word kind]   │  │    note        │  │    ended_at          │
│ last_opened  │  │     word         │  │    chapter     │  │    last_activity_at  │
└──────────────┘  │     meaning      │  │    created_at  │  │    start_cfi         │
       │          │     thinking     │  └────────────────┘  │    end_cfi           │
       │ N        │       (JSONB)    │           │          │    start_chapter     │
       │          │    [grammar kind]│           │          │    end_chapter       │
       │          │     pattern      │           │          │    created_at        │
       │          │     explanation  │           │          └──────────────────────┘
       │          │     interp_guide │           │                    │
       │          │    [공통]        │           │                    │
       │          │     example_sent │           │                    │
       │          │     chapter      │           │                    │
       │          │     review_count │           │                    │
       │          │     next_review  │           │                    │
       │          │     ease_factor  │           │                    │
       │          │     interval_days│           │                    │
       │          │     created_at   │           │                    │
       │          └──────────────────┘           │                    │
       │                   │                     │                    │
       │ 1                 │ N                   │ 1                  │ 1
       │                   │                     │                    │
       └───────────────────┴─────────────────────┴────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────┐
                            │      books       │
                            ├──────────────────┤
                            │ 🔑 book_id       │
                            │    title         │
                            │    author        │
                            │    book_hash     │
                            │    source        │   ← 'user_upload' / 'curated_free'
                            │    created_at    │
                            └──────────────────┘
```

---

## 관계 카디널리티

| 관계 | 카디널리티 | 의미 |
|---|---|---|
| auth.users — user_books | 1:N | 한 user는 여러 책 가짐 |
| books — user_books | 1:N | 한 책은 여러 user에 매달림 |
| auth.users — cards | 1:N | 한 user가 여러 카드 만듦 |
| books — cards | 1:N | 한 책에서 여러 카드 나옴 |
| auth.users — sentences | 1:N | 한 user가 여러 문장 보관 |
| books — sentences | 1:N | 한 책에서 여러 문장 보관 |
| auth.users — reading_sessions | 1:N | 한 user가 여러 세션 |
| books — reading_sessions | 1:N | 한 책에 여러 세션 |

users ↔ books의 본래 N:M 관계는 user_books를 중간에 끼워서 1:N + 1:N으로 분해됨.

cards / sentences / reading_sessions 모두 users·books 두 부모를 동시에 참조 — 평등한 다중 참조 구조.

---

## 핵심 설계 결정 + 근거

### 1. books를 글로벌 단일 행으로 (B 방식 채택)

**대안 A** (탈락): `books`에 `user_id` 박아서 사용자마다 책 행 따로
**대안 B** (채택): `books`는 책 자체의 메타데이터만 한 행, `user_books` 중간 테이블이 누가 가졌는지 표현

채택 근거:
- 같은 책 정보(title, author)가 사용자마다 중복 저장되지 않음 (3NF 위반 회피)
- 책 제목 오타 수정 시 한 곳만 갱신 (갱신 이상 회피)
- book_hash 트릭(같은 책 자동 매칭) 효과 극대화
- 시드 데이터(저작권 free 책 50~100권) 한 번만 깔면 모든 사용자가 공유
- 미래 확장(예: "이 책을 읽은 다른 사용자들" 같은 소셜 기능)에 자연스럽게 열려있음

### 2. reading_sessions 풀 세션 기록 (A 방식 채택)

**대안 A** (채택): 읽기 시작/종료할 때마다 행 추가
**대안 B** (탈락): `user_books.total_minutes` 카운터만 += 증가
**대안 C** (탈락): v2에선 추적 안 함

채택 근거:
- 100명 × 매일 1세션 × 365일 = **36,500행/년** — PostgreSQL에 매우 가벼움
- 풍부한 분석 가능: 챕터별 체류 시간, 시간대 패턴, 학습 효율, 읽은 분량 추이
- `start_cfi`/`end_cfi`: EpubReader가 이미 CFI로 진행 저장하므로 거의 공짜
- 운영자 입장에서 의미 있는 데이터 수집 가능

**프라이버시 메모**: 익명 사용자라도 user_id로 행동 패턴 추적은 가능. 정식 서비스 시 개인정보처리방침에 "읽기 패턴 데이터 수집·분석" 명시 필요.

### 3. cards 통합 모델 + sentences 분리 (확정)

**시스템 프롬프트 v3 응답 구조와 정합**:
- AI 응답이 `vocab` (word 학습 단위) / `grammar` (grammar 학습 단위) / `sentence_thinking` 로 명확히 나뉨
- vocab/grammar는 학습 단위(SRS 대상) → cards 한 테이블에 kind로 구분
- sentence는 학습 단위 아님 (보관·감상) → 별도 sentences 테이블

**cards 통합 채택 근거** (강의 4 모델 A):
- 종류가 2개(word, grammar)뿐이고 안정적
- 공통 작업(전체 카드 정렬·필터, SRS 복습 카드 조회)이 자주 일어남
- 종류별 특수 컬럼 수가 적음
- 작은 팀(혼자) — DB 무결성을 코드 + CHECK 제약으로 보장 가능

**도메인 무결성 보강**: CHECK 제약 2개로 kind별 컬럼 강제 (아래 SQL 참조).

### 4. thinking은 JSONB 컬럼 (강의 4 모델 D 적용)

cards.thinking을 별도 테이블로 안 빼고 cards 안의 JSONB 컬럼으로 둠.

**근거**:
- thinking 항목은 그 word 카드와만 함께 살고, 다른 카드와 공유 안 함
- thinking 항목별 검색·정렬 일이 거의 없음 (카드와 함께 표시만)
- 항목 수와 type 조합이 가변 (0~여러 개, core_image/culture/author_intent 섞임)
- **같은 type 항목 둘 이상도 가능** — 분리 컬럼으론 1NF 위반 불가피
- JSONB는 인덱싱(GIN), 안의 필드 조회, 부분 업데이트 다 지원하는 PostgreSQL 일급 시민

**저장 형태**:
```json
[
  { "type": "core_image", "title": "...", "body": "..." },
  { "type": "culture", "title": "...", "body": "..." }
]
```

word kind에선 NOT NULL (빈 배열 `[]`이라도). grammar kind에선 NULL.

### 5. sentence_thinking 처리 (v2 단계)

시스템 프롬프트 v3에 `sentence_thinking` 배열이 있지만, v2 단계에선 **응답에 표시만 하고 DB 저장 안 함**.

근거:
- 빈도 낮음 — 대부분 응답에서 빈 배열
- 저장 자리가 모호 — 어느 카드에도 매달지 않으니 자체 행을 만들어야 함
- sentence 카드 UI가 v3에서 활성화되면, 그때 "이 문장 저장" 시 sentence_thinking이 있으면 `sentences.note` 필드에 자동 통합

v3 단계에서 결정할 자리.

### 6. 미종료 reading_sessions 처리 (A + C 결합)

브라우저가 정상 종료 안 될 수 있어 ended_at이 영원히 NULL이 되는 케이스 방지.

**대안 비교**:
- **(A) 클라이언트 visibility change/beforeunload 감지**: 정확하지만 모바일 백그라운드/앱 강제 종료 시 누락
- **(B) 주기적 cron으로 강제 종료**: 안정적이지만 인프라 복잡 (v2 규모엔 오버킬)
- **(C) 다음 세션 시작 시 이전 세션 자동 정리**: 단순하지만 사용자 안 돌아오면 처리 안 됨
- **(D) Heartbeat ping**: 가장 정확하지만 DB 부담 큼

**채택**: **A + C 결합 + `last_activity_at` 컬럼**

구체 방식:
1. reading_sessions에 `last_activity_at timestamptz NOT NULL DEFAULT now()` 컬럼 추가
2. 사용자 활동(페이지 넘김, 카드 추가) 때마다 클라이언트가 last_activity_at 갱신
3. 탭 닫힘/visibility 변경 시 ended_at = last_activity_at으로 마감 시도 (best effort)
4. 새 세션 시작 시 이전 미종료 세션 있으면 ended_at = last_activity_at으로 자동 마감

이러면 정상 종료는 즉시 마감, 비정상 종료는 다음 세션 시작 시 정리, 영원히 안 돌아오는 사용자는 ended_at = NULL 유지 (데이터 손실 아님).

heartbeat 없이도 95% 케이스 정확히 잡힘. 인프라 단순.

---

## 컬럼 SQL (v2 확정)

```sql
-- ============================================
-- books (책 메타데이터, 글로벌 단일 행)
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
-- user_books (users ↔ books N:M 중간 + 진척도)
-- ============================================
CREATE TABLE public.user_books (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  progress_cfi text,
  progress_pct numeric(4,1) CHECK (progress_pct BETWEEN 0 AND 100),
  added_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz,
  PRIMARY KEY (user_id, book_id)
);

-- ============================================
-- cards (학습 카드: word + grammar 통합)
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
  next_review_at timestamptz,
  ease_factor numeric(3,2) NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

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
-- sentences (인상 깊은 문장 컬렉션, v3 UI 활성)
-- ============================================
CREATE TABLE public.sentences (
  sentence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  sentence text NOT NULL,
  note text,
  chapter text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- reading_sessions (읽기 세션 풀 기록)
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
```

---

## 인덱스 SQL (v2 확정)

자주 일어날 쿼리 예측을 기반으로 6개 인덱스 설계.

**원칙**:
- 모든 데이터가 사용자별 격리 → `(user_id, ...)` 패턴 표준
- 부분 인덱스(Partial Index)로 인덱스 크기 절약
- PK/UNIQUE는 자동 인덱스이므로 별도 안 만듦
- FK 컬럼은 PostgreSQL이 자동 인덱스 안 만들어줌 — 명시적으로 만들거나, 복합 인덱스의 첫 컬럼으로 커버

```sql
-- ============================================
-- user_books
-- ============================================
-- 라이브러리 화면: 사용자의 책 목록, 최근 연 순
-- (user_id, book_id) PK가 이미 있어 책별 진척도 조회는 빠름
CREATE INDEX user_books_user_last_opened_idx
  ON public.user_books (user_id, last_opened_at DESC NULLS LAST);

-- ============================================
-- cards
-- ============================================
-- 단어장 화면: 사용자의 카드 목록 (책별 필터 옵션, 최신순)
-- left-prefix 원칙으로 "사용자의 전체 카드" 쿼리도 이 인덱스 활용
CREATE INDEX cards_user_book_created_idx
  ON public.cards (user_id, book_id, created_at DESC);

-- SRS 복습 (v3): 복습 일정 잡힌 카드만 인덱싱 (부분 인덱스)
CREATE INDEX cards_user_review_idx
  ON public.cards (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ============================================
-- sentences
-- ============================================
-- 문장 컬렉션 (v3): cards와 동일 패턴
CREATE INDEX sentences_user_book_created_idx
  ON public.sentences (user_id, book_id, created_at DESC);

-- ============================================
-- reading_sessions
-- ============================================
-- 세션 조회: 사용자의 최근 세션 (책별 옵션)
CREATE INDEX reading_sessions_user_book_started_idx
  ON public.reading_sessions (user_id, book_id, started_at DESC);

-- 미종료 세션 찾기: 다음 세션 시작 시 이전 미종료 세션 정리
-- 대부분 세션은 종료됨 → 미종료만 인덱싱 (부분 인덱스)
CREATE INDEX reading_sessions_user_unended_idx
  ON public.reading_sessions (user_id)
  WHERE ended_at IS NULL;
```

### 보류/미적용 인덱스

| 인덱스 후보 | 왜 보류? | 추가 시점 |
|---|---|---|
| cards (user_id, kind, ...) | kind는 두 값뿐 — 선택성 낮음 | 단어/문법 탭 쿼리가 실제로 느릴 때 |
| books (source) | 사용자 카탈로그 화면 미구현 | 시드 데이터 카탈로그 화면 만들 때 |
| cards (thinking) GIN | thinking 내부 검색 기능 없음 | "특정 type thinking 있는 카드" 검색 기능 추가 시 |

### 명명 규칙

`{테이블명}_{컬럼명}_{idx}` 패턴 통일. 부분 인덱스나 특수 인덱스는 의미 라벨 추가 (`_review_idx`, `_unended_idx`).

---

## 미정 / 다음 단계

- [x] ~~cards 테이블 구조 확정~~ — **통합 모델 + sentences 분리 + thinking JSONB로 확정**
- [x] ~~각 테이블 컬럼 설계~~ — **위 SQL로 확정** (타입·NULL·기본값·CHECK 제약 포함)
- [x] ~~인덱스 설계~~ — **6개 인덱스 + 부분 인덱스 2개로 확정** (위 SQL 섹션)
- [ ] **RLS 정책** — "본인 데이터만 접근" (books는 글로벌 읽기 / 쓰기는 admin만 같은 별도 정책 필요)
- [ ] **FK CASCADE 정책 검증** — 사용자 삭제 시 cards·user_books·sentences·reading_sessions 같이 삭제 (✅ 적용됨). books는 글로벌이라 사용자가 삭제 못 함 (RLS로 강제)
- [ ] **저작권 free 책 시드 데이터 정책** — 관리자 큐레이션 vs 사용자 카탈로그 검색
- [ ] **sentence_thinking 저장 정책** — v3 sentence 카드 UI 활성화 시 sentences.note에 흡수 또는 별도 컬럼 (현재는 미정)
- [ ] **클라이언트 last_activity_at 갱신 정책** — 어떤 사용자 활동을 트리거로 잡을지 (페이지 넘김, 카드 추가, 단어 선택, 스크롤 등)

---

## plan_v2와의 관계 (합치기 가이드)

이 파일은 plan_v2_26_05_24.md의 다음 섹션들을 더 구체적으로 풀어냄. 사용자가 합칠 때 참고:

| plan_v2 섹션 | 이 파일 위치 | 비고 |
|---|---|---|
| A. 응답 구조 | (system_prompt_v3로 이관됨) | thinking 평면 배열 → 학습 단위 중심 재편 |
| B. 출력 형식 JSON | (system_prompt_v3로 이관됨) | vocab/grammar/sentence_thinking 3 배열 |
| D. 단어장 kind 통합 모델 | "엔티티 목록 > cards, sentences" + 결정 3 | v3 응답 구조에 맞춰 word/grammar는 cards 통합, sentence는 별도 |
| D'. 학습자료 범위 (B 책 단위, C SRS) | "엔티티 목록 > reading_sessions, cards" | C SRS는 cards에 `review_count`/`next_review_at` 컬럼 (word + grammar 모두 적용) |
| G. 책 메타데이터 | "엔티티 목록 > books" + 결정 1 | books 정규화 결정 추가 |
| H. 맥락 문장 (앞뒤 2문장) | (해당 없음 — 프롬프트 빌드 영역) | DB 스키마와 무관 |
| I. 백엔드 & DB | "백엔드 환경" | 그대로 흡수 |
| J. 스토리지 정책 | "백엔드 환경" 한 줄 | 상세는 plan_v2에 두는 게 자연스러움 |

plan_v2의 "다음 세션 핵심 주제: Supabase 스키마 설계" 6개 체크박스 진척:
- ✅ 테이블 목록 합의
- ✅ 각 테이블 컬럼 설계 (위 SQL)
- ✅ 테이블 간 관계 + FK CASCADE 정책
- ✅ 인덱스 설계
- ⏳ RLS 정책 (다음 강의)
- ⏳ 저작권 free 책 시드 데이터 정책

또한 plan_v2 A/B/D 섹션은 system_prompt_v3로 분화되어 더 이상 plan_v2 안에서 단독 의미를 갖지 않음. 합칠 때 plan_v2의 해당 섹션들에 "→ system_prompt_v3 참조" 메모를 남기는 것이 좋을 듯.
