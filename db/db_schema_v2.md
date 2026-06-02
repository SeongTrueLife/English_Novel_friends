# DB Schema v2 — SentenceMate Reader

작성: 2026-06-01 (시스템 프롬프트 v3 반영 업데이트)
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
| 비용 예상 (100명 규모) | Free tier 안에 충분 (DB ~170MB / Storage ~300MB / Bandwidth 2~3GB) |
| 스토리지 정책 | 하이브리드: 저작권 free 책 + 모든 메타데이터 → Supabase / 사용자 epub 파일 → IndexedDB |

---

## 엔티티 목록 (v2 확정)

| 엔티티 | 역할 |
|---|---|
| **users** | 사용자 (익명 + 이메일 연동 후 사용자 모두 포함) |
| **books** | 책 메타데이터 (글로벌 단일 행, book_hash로 같은 책 식별) |
| **user_books** | "어떤 user가 어떤 book을 라이브러리에 가졌는가" + 읽기 진척도. users ↔ books N:M 중간 테이블 |
| **cards** | 학습 카드. kind: `word` \| `grammar` 통합. word kind는 thinking을 JSONB로 보유 |
| **sentences** | 인상 깊은 문장 컬렉션 (학습 단위 아님, 보관용). 데이터 모델만 v2, UI는 v3 |
| **reading_sessions** | 읽기 세션 기록 (시작/종료/CFI 위치/챕터). 운영자 분석 + 학습 통계 동력 |

### 제외된 엔티티

| 후보 | 제외 사유 |
|---|---|
| ~~study_stats~~ | derived data — 쿼리(`COUNT`, `SUM`, `GROUP BY`)로 집계. 별도 테이블은 동기화 문제 유발. 우리 규모(100~1000명)에서 미리 저장할 필요 없음 |
| ~~card_thinking 별도 테이블~~ | thinking 항목은 그 카드와만 함께 살고 별도 검색 안 함. cards.thinking JSONB로 통째 저장이 자연스러움 (강의 4 모델 D 적용) |

---

## ERD

```
┌──────────────────┐
│      users       │
├──────────────────┤
│ 🔑 user_id       │
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
│ last_opened  │  │     word         │  │    chapter     │  │    start_cfi         │
└──────────────┘  │     meaning      │  │    created_at  │  │    end_cfi           │
       │          │     thinking     │  └────────────────┘  │    start_chapter     │
       │ N        │       (JSONB)    │           │          │    end_chapter       │
       │          │    [grammar kind]│           │          └──────────────────────┘
       │          │     pattern      │           │ N                  │
       │          │     explanation  │           │                    │ N
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
| users — user_books | 1:N | 한 user는 여러 책 가짐 |
| books — user_books | 1:N | 한 책은 여러 user에 매달림 |
| users — cards | 1:N | 한 user가 여러 카드 만듦 |
| books — cards | 1:N | 한 책에서 여러 카드 나옴 |
| users — sentences | 1:N | 한 user가 여러 문장 보관 |
| books — sentences | 1:N | 한 책에서 여러 문장 보관 |
| users — reading_sessions | 1:N | 한 user가 여러 세션 |
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
- 100명 × 매일 1세션 × 365일 = **36,500행/년** — PostgreSQL에 매우 가벼움 (부담 시점은 보통 수천만~수억 행)
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
- 종류가 2개(word, grammar)뿐이고 안정적 — 늘어날 가능성 낮음
- 공통 작업(전체 카드 정렬·필터, SRS 복습 카드 조회)이 자주 일어남
- 종류별 특수 컬럼 수가 적음 (word는 word/meaning/thinking, grammar는 pattern/explanation/interpretation_guide)
- 작은 팀(혼자) — DB 무결성을 코드 + CHECK 제약으로 보장 가능

**도메인 무결성 보강** (CHECK 제약):
```sql
-- word kind: word, meaning 필수, pattern/explanation/interpretation_guide NULL
CHECK (
  kind != 'word' OR (
    word IS NOT NULL AND meaning IS NOT NULL
    AND pattern IS NULL AND explanation IS NULL AND interpretation_guide IS NULL
  )
)

-- grammar kind: pattern, explanation, interpretation_guide 필수, word/meaning/thinking NULL
CHECK (
  kind != 'grammar' OR (
    pattern IS NOT NULL AND explanation IS NOT NULL AND interpretation_guide IS NOT NULL
    AND word IS NULL AND meaning IS NULL AND thinking IS NULL
  )
)
```

### 4. thinking은 JSONB 컬럼 (강의 4 모델 D 적용)

cards.thinking을 별도 테이블로 안 빼고 cards 안의 JSONB 컬럼으로 둠.

**근거**:
- thinking 항목은 그 word 카드와만 함께 살고, 다른 카드와 공유 안 함
- thinking 항목별 검색·정렬 일이 거의 없음 (카드와 함께 표시만)
- 항목 수와 type 조합이 가변 (0~여러 개, core_image/culture/author_intent 섞임)
- JSONB로 두면 카드 한 행 조회로 모든 정보 가져옴 — JOIN 없음
- PostgreSQL JSONB는 인덱싱(GIN)과 안의 필드 조회 다 지원 — 나중에 검색 필요해지면 그때 인덱스 추가

**저장 형태**:
```json
{
  "thinking": [
    { "type": "core_image", "title": "...", "body": "..." },
    { "type": "culture", "title": "...", "body": "..." }
  ]
}
```

빈 배열 `[]`이거나 NULL (grammar kind일 때)인 경우도 처리.

### 5. sentence_thinking 처리 (v2 단계)

시스템 프롬프트 v3에 `sentence_thinking` 배열이 있지만, v2 단계에선 **응답에 표시만 하고 DB 저장 안 함**.

근거:
- 빈도 낮음 — 대부분 응답에서 빈 배열
- 저장 자리가 모호 — 어느 카드에도 매달지 않으니 자체 행을 만들어야 함
- sentence 카드 UI가 v3에서 활성화되면, 그때 "이 문장 저장" 시 sentence_thinking이 있으면 `sentences.note` 필드에 자동 통합

v3 단계에서 결정할 자리.

---

## 미정 / 다음 단계

- [x] ~~cards 테이블 구조 확정~~ — **통합 모델 + sentences 분리 + thinking JSONB로 확정**
- [ ] **각 테이블 컬럼 설계** — PostgreSQL 타입(`uuid`, `text`, `timestamptz`, `jsonb`, `numeric`, `boolean` 등)·NULL 허용·기본값·CHECK 제약 전체
- [ ] **인덱스 설계** — 자주 일어날 쿼리 예측 → 인덱스 (cards(user_id, book_id), cards(user_id, next_review_at) 등)
- [ ] **RLS 정책** — "본인 데이터만 접근" (특히 books는 글로벌 읽기 / 쓰기는 admin만 같은 별도 정책 필요)
- [ ] **FK CASCADE 정책** — 사용자 삭제 시 cards·user_books·sentences·reading_sessions 같이 삭제? books는 글로벌이라 보존
- [ ] **저작권 free 책 시드 데이터 정책** — 관리자 큐레이션 vs 사용자 카탈로그 검색
- [ ] **sentence_thinking 저장 정책** — v3 sentence 카드 UI 활성화 시 sentences.note에 흡수 (현재는 미정)

---

## plan_v2와의 관계 (합치기 가이드)

이 파일은 plan_v2_26_05_24.md의 다음 섹션들을 더 구체적으로 풀어냄. 사용자가 합칠 때 참고:

| plan_v2 섹션 | 이 파일 위치 | 비고 |
|---|---|---|
| A. 응답 구조 | (system_prompt_v3로 이관됨) | thinking 평면 배열 → 학습 단위 중심 재편 |
| B. 출력 형식 JSON | (system_prompt_v3로 이관됨) | vocab/grammar/sentence_thinking 3 배열 |
| D. 단어장 kind 통합 모델 | "엔티티 목록 > cards, sentences" + 결정 3 | v3 응답 구조에 맞춰 word/grammar는 cards 통합, sentence는 별도 |
| D'. 학습자료 범위 (B 책 단위, C SRS) | "엔티티 목록 > reading_sessions, cards" | C SRS는 cards에 `review_count`/`next_review_at` 컬럼 (word kind만 의미 있음) |
| G. 책 메타데이터 | "엔티티 목록 > books" + 결정 1 | books 정규화 결정 추가 |
| H. 맥락 문장 (앞뒤 2문장) | (해당 없음 — 프롬프트 빌드 영역) | DB 스키마와 무관 |
| I. 백엔드 & DB | "백엔드 환경" | 그대로 흡수 |
| J. 스토리지 정책 | "백엔드 환경" 한 줄 | 상세는 plan_v2에 두는 게 자연스러움 |

plan_v2의 "다음 세션 핵심 주제: Supabase 스키마 설계" 6개 체크박스 진척:
- ✅ 테이블 목록 합의 (이 파일 "엔티티 목록")
- ⏳ 각 테이블 컬럼 설계 (다음 단계)
- ✅ 테이블 간 관계 (이 파일 "관계 카디널리티")
- ⏳ 인덱스 설계 (다음 단계)
- ⏳ RLS 정책 (다음 단계)
- ⏳ 저작권 free 책 시드 데이터 정책 (다음 단계)

또한 plan_v2 A/B/D 섹션은 system_prompt_v3로 분화되어 더 이상 plan_v2 안에서 단독 의미를 갖지 않음. 합칠 때 plan_v2의 해당 섹션들에 "→ system_prompt_v3 참조" 메모를 남기는 것이 좋을 듯.
