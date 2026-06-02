# DB Schema v2 — SentenceMate Reader

작성: 2026-06-01
관련 문서: [../plan_v2_26_05_24.md](../plan_v2_26_05_24.md) — v2 전반 결정사항
학습 노트: [db_learning_notes.md](db_learning_notes.md) — DB 개념 일반론

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
| **cards** | 학습 카드. kind: word / note / sentence 통합 (재검토 예정) |
| **reading_sessions** | 읽기 세션 기록 (시작/종료/CFI 위치/챕터). 운영자 분석 + 학습 통계 동력 |

### 제외된 엔티티

| 후보 | 제외 사유 |
|---|---|
| ~~study_stats~~ | derived data — 쿼리(`COUNT`, `SUM`, `GROUP BY`)로 집계. 별도 테이블은 동기화 문제 유발. 우리 규모(100~1000명)에서 미리 저장할 필요 없음. 예외는 통계 계산이 너무 비싸서 화면이 느려질 때만(materialized view 또는 summary table 패턴) |

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
        ├──────────────────────────────┬──────────────────────┐
        │                              │                      │
        │ N                            │ N                    │ N
        │                              │                      │
┌──────────────────┐          ┌──────────────────┐  ┌──────────────────────┐
│   user_books     │          │      cards       │  │  reading_sessions    │
├──────────────────┤          ├──────────────────┤  ├──────────────────────┤
│ 🔑 (user_id,     │          │ 🔑 card_id       │  │ 🔑 session_id        │
│      book_id)    │          │  * user_id (FK)  │  │  * user_id (FK)      │
│    progress_cfi  │          │  * book_id (FK)  │  │  * book_id (FK)      │
│    progress_pct  │          │    kind          │  │    started_at        │
│    added_at      │          │    word          │  │    ended_at          │
│    last_opened_at│          │    meaning       │  │    start_cfi         │
└──────────────────┘          │    example_sent  │  │    end_cfi           │
        │                     │    note_type     │  │    start_chapter     │
        │ N                   │    title         │  │    end_chapter       │
        │                     │    body          │  │ (cards_added_count?) │
        │                     │    sentence      │  └──────────────────────┘
        │                     │    review_count  │           │
        │                     │    next_review_at│           │ N
        │                     │    chapter       │           │
        │                     │    created_at    │           │
        │                     └──────────────────┘           │
        │                              │                     │
        │                              │ N                   │
        │                              │                     │
        │ 1                            │ 1                   │ 1
        │                              │                     │
        └──────────────────────────────┴─────────────────────┘
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
| users — reading_sessions | 1:N | 한 user가 여러 세션 |
| books — reading_sessions | 1:N | 한 책에 여러 세션 |

users ↔ books의 본래 N:M 관계는 user_books를 중간에 끼워서 1:N + 1:N으로 분해됨.

cards는 users·books 두 부모를 동시에 참조 — "테이블 간 위계가 트리가 아니라 그물"의 실제 예시.

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

### 3. cards 통합 모델 — 재검토 예정

plan_v2 D에서 "kind 통합 모델"로 결정되었으나, 다음 강의에서 재검토.

**현재 통합 모델의 문제**:
- 컬럼이 sparse — kind에 따라 NULL이 많음 (word kind는 noteType/sentence NULL, note kind는 word/meaning NULL 등)
- 도메인 무결성 약함 (DB가 "이건 word니까 word/meaning 필수, 나머지 NULL" 강제 못 함)

**대안들**:
| 방식 | 장점 | 단점 |
|---|---|---|
| **통합 (현재)** | 한 테이블로 검색·필터 쉬움 | NULL 많음, 무결성 약함 |
| **완전 분리** | NULL 없음, 무결성 강함 | "내 모든 카드" 시 3개 UNION, SRS 공통 컬럼 3중복 |
| **하이브리드(상속)** | 양쪽 이점 다 가짐 | 살짝 복잡 |

→ 다음 강의에서 토론 후 확정.

---

## 미정 / 다음 단계

- [ ] **cards 테이블 구조 확정** — 통합 vs 분리 vs 하이브리드 토론
- [ ] **각 테이블 컬럼 설계** — 타입(`uuid`, `text`, `timestamptz` 등)·NULL 허용·기본값·CHECK 제약
- [ ] **인덱스 설계** — 자주 일어날 쿼리 예측 → 인덱스
- [ ] **RLS 정책** — "본인 데이터만 접근" (특히 books는 글로벌이라 별도 정책 필요)
- [ ] **FK CASCADE 정책** — 사용자 삭제 시 cards·user_books·reading_sessions 같이 삭제? books는 글로벌이라 보존
- [ ] **저작권 free 책 시드 데이터 정책** — 관리자 큐레이션 vs 사용자 카탈로그 검색

---

## plan_v2와의 관계 (합치기 가이드)

이 파일은 plan_v2_26_05_24.md의 다음 섹션들을 더 구체적으로 풀어냄. 사용자가 합칠 때 참고:

| plan_v2 섹션 | 이 파일 위치 | 비고 |
|---|---|---|
| I. 백엔드 & DB | "백엔드 환경" | 그대로 흡수 |
| J. 스토리지 정책 | "백엔드 환경" 한 줄 | 상세는 plan_v2에 두는 게 자연스러움 |
| D. 단어장 kind 통합 모델 | "엔티티 목록 > cards" + 결정 3 | 재검토 진행 중 |
| D'. 학습자료 범위 (B 책 단위, C SRS) | "엔티티 목록 > reading_sessions, cards" | C SRS는 cards에 `review_count`/`next_review_at` 컬럼만 |
| G. 책 메타데이터 | "엔티티 목록 > books" + 결정 1 | books 정규화 결정 추가 |
| H. 맥락 문장 (앞뒤 2문장) | (해당 없음 — 프롬프트 빌드 영역) | DB 스키마와 무관 |

plan_v2의 "다음 세션 핵심 주제: Supabase 스키마 설계" 6개 체크박스는 이 파일의 "미정 / 다음 단계"로 이관됨.
