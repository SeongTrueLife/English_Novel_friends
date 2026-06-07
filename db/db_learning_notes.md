# DB 학습 노트

작성: 2026-06-01 (강의 4~9 추가 업데이트)
적용 프로젝트: SentenceMate Reader v2 (예시로 활용)
관련 설계 파일: [db_schema_v2.md](db_schema_v2.md)

> DB 개념 일반론. 이 프로젝트뿐 아니라 다른 프로젝트에서도 참고 가능.

---

## 강의 1: 데이터를 어떻게 저장할 것인가

### 데이터 저장 방식의 스펙트럼

점점 "구조적"이 되어감:

```
변수/배열 (메모리)   → 프로그램 죽으면 사라짐
    ↓
파일 (JSON, CSV)     → 영속성은 있지만 검색·수정 비효율
    ↓
Key-Value            → "key 주면 value 줄게" 단순 사전 (Redis, LocalStorage)
    ↓
문서 DB              → JSON 덩어리 통째로 저장 (MongoDB, Firestore)
    ↓
관계형 DB            → 데이터를 쪼개서 표(table)로 정리 (PostgreSQL, MySQL)
    ↓
그래프 DB            → 노드와 엣지로 관계 자체가 데이터 (Neo4j)
```

각자 잘 맞는 도메인이 다름. 도메인 명확하면 관계형, 의미 관계가 협상의 대상이면 그래프/온톨로지.

### 관계형 DB의 진짜 의미

- "Relational" = 수학의 **관계(relation)** = "표(table)" 자체를 가리킴
- 한국어 번역 "관계형"이 "테이블끼리의 관계"로 들리지만, 본질은 "**모든 데이터를 격자 모양 표에 욱여넣는다**"
- "테이블끼리의 관계(FK)"는 부차적 결과

### 단일 출처 원칙 (Single Source of Truth)

- 같은 정보는 딱 한 곳에만 저장
- 나머지는 그 한 곳을 **가리키기만**
- 이 원칙을 어기면 → 중복, 갱신 이상, 데이터 불일치

### 잡탕 테이블의 4가지 죄 (정규화의 동기)

한 줄짜리 표에 여러 종류의 정보를 박았을 때:

| 죄 | 영문 | 의미 |
|---|---|---|
| 중복 | Redundancy | 같은 정보가 여러 행에 반복 저장 |
| 갱신 이상 | Update Anomaly | 한 정보 바꾸려면 여러 행 다 바꿔야 함. 하나라도 빠뜨리면 모순 |
| 삽입 이상 | Insertion Anomaly | 의도한 데이터를 깔끔하게 못 넣음 (단어 없으면 책 등록 불가 같은 상황) |
| 삭제 이상 | Deletion Anomaly | 한 행 지웠더니 무관한 정보까지 사라짐 |

### 함수적 종속성 (FD, Functional Dependency)

- "A가 정해지면 B도 정해진다" 관계
- `A → B` 표기 (수학의 함수 f(x)=y와 같은 발상)
- 예: `user_id → user_email`, `book_id → book_title, book_author`

**정규화의 한 줄 정의**: "각 FD가 자기 자리(테이블)를 갖도록 분해하는 것"

---

## 강의 2: 정규형 (Normal Form)

NF = Normal Form. **테이블 개수가 아니라 "테이블이 만족해야 하는 조건의 단계"**.

### 1NF — "한 셀엔 값 하나만"

- 각 셀에 **원자값(atomic value)** 만
- 배열·콤마 리스트·중첩 객체 금지

```
❌ 위반:
| word    | tags                    |
| uncanny | noun, adjective, formal |

✅ 1NF: 별도 tags 테이블로 분리
```

### 2NF — "복합키 일부 종속 금지"

- 복합 PK일 때만 의미 있음 (단일 PK 테이블은 1NF만 만족하면 자동 2NF)
- **부분 종속(Partial Dependency)** 제거

```
❌ 위반: PK = (user_id, book_id)인데 book_title이 book_id에만 의존
| user_id | book_id | book_title | 진척도 |
| abc     | 1       | Pride...   | 30%   |
| xyz     | 1       | Pride...   | 50%   |  ← book_title 중복

✅ 2NF: books 테이블 분리
```

### 3NF — "비-PK 컬럼 거친 종속 금지"

- **이행적 종속(Transitive Dependency)** 제거
- `PK → A → B` 구조면 B를 분리

```
❌ 위반:
| card_id (PK) | user_id | user_email |
| 1            | abc     | a@x.com    |  ← user_email은 user_id 거쳐서만 결정됨

✅ 3NF: users 테이블 분리
```

### 한 줄 요약

> **1NF**: 셀 안 쪼개기 / **2NF**: 복합키 일부 종속 분리 / **3NF**: 비-PK 거친 종속 분리

실무 표준은 **3NF까지**. BCNF/4NF/5NF는 특수 케이스.

### 반정규화 (Denormalization)

- 성능을 위해 일부러 정규화를 깨는 것
- "정규화는 옳지만 너무 많이 쪼개면 JOIN 7번 해야 해서 느림 → 일부 합쳐두자"
- 의도적 선택. 자주 등장하는 경우:
  - **카운터 컬럼**: 매번 COUNT(*) 하지 말고 결과를 컬럼에 캐싱 (예: 좋아요 수)
  - **마지막 활동 시각**: max() 쿼리 대신 컬럼에 저장 (예: user_books.last_opened_at)
  - **materialized view**: 비싼 집계 결과를 미리 계산해서 저장
- 비용: 동기화 책임 (원본 바뀌면 캐시도 갱신해야 함)

---

## 강의 2.5: 관계의 카디널리티

### 카디널리티 두 가지 의미

1. 관계의 형태 (1:1, 1:N, N:M)
2. 테이블의 행 개수

### 세 가지 관계 형태

| 형태 | 의미 | 비고 |
|---|---|---|
| **1:1** | 한 행 ↔ 한 행 | 흔치 않음. 대부분 한 테이블로 합쳐도 됨 |
| **1:N** | 한 행 ↔ 여러 행 | 가장 흔함 |
| **N:M** | 양쪽 모두 여러 행 | 두 테이블만으론 표현 불가 — 중간 테이블 필요 |

### 1:N의 구현

> "N쪽 테이블이 1쪽 테이블의 PK를 FK로 들고 있음"

```
users (1)              cards (N)
abc ────────┐
            ├─→ card 1 (user_id: abc)
            ├─→ card 2 (user_id: abc)
            └─→ card 3 (user_id: abc)
```

### N:M의 함정과 해소

- 양쪽 다 FK 컬럼 하나에 N개 값 박아야 함 → 1NF 위반
- **해결**: 중간 테이블(junction table / bridge table)을 끼워서 1:N + 1:N으로 분해

```
users (1) ──→ user_books (N) ←── (1) books
                 ↑
        각 행: (user_id, book_id) + 그 조합만의 정보(진척도, 추가일)
```

### 중간 테이블의 진짜 가치

- N:M 해소용 장치만이 아님
- **"두 엔티티의 조합 자체가 별개 엔티티"** 인 경우가 많음
- 그 조합만의 정보(예: 진척도)를 매다는 자리

### 메타 교훈

> **"엔티티의 정체를 어떻게 잡느냐에 따라 카디널리티와 테이블 구조가 완전히 달라진다."**

같은 도메인이라도 모델링 선택에 따라 1:N도 N:M도 됨. 예: 단어를 카드 안의 필드로 두면(우리 앱) cards-books는 1:N. 단어를 별도 엔티티로 두면 words-books는 N:M.

---

## 강의 3: ERD

### ERD가 왜 필요한가

- 코드 작성 전 설계 검증
- 머릿속 모델이 그림에 박히는 순간 모호함 드러남
- 미래 자신 또는 다른 사람과 소통

### 표기법 — Crow's Foot이 실무 표준

선의 양 끝에 두 가지 정보 표시:
- **최소(왼쪽 기호)**: 0인가 1인가
- **최대(오른쪽 기호)**: 1인가 N인가

| 기호 | 의미 |
|---|---|
| `─||` | 정확히 1 (mandatory one) |
| `─o|` | 0 또는 1 (optional one) |
| `─}|` | 1 이상 (mandatory many) — 까마귀 발 |
| `─}o` | 0 이상 (optional many) |

### 예시 읽기

```
users ─||────────────────}o─ cards
       ↑                  ↑
   "한 카드는           "한 사용자는
    반드시 사용자       카드를 0개 이상
    1명에게 속함"       가질 수 있음"
```

신규 사용자는 카드가 0개 가능 → 카드 쪽 0 이상(`─}o`).
사용자 없는 카드는 절대 안 됨 → 사용자 쪽 정확히 1(`─||`).

### 간략 표기

- 1:1, 1:N, N:M 만으로도 의사소통 가능
- 0/1 구분(optionality)은 컬럼 설계 시 NULL 허용 여부로 다시 짚음

---

## 강의 4: 테이블 모델 패턴 — 통합/분리/하이브리드/JSONB

여러 종류의 비슷한 엔티티(예: 학습 카드의 word/grammar/sentence)를 어떻게 표현할지 4가지 패턴.

### 모델 A — 통합 (Single Table Inheritance)

한 테이블에 모든 종류, `kind` 컬럼으로 구분.

```sql
cards
- card_id, user_id, kind: 'word' | 'grammar'
- word, meaning, thinking        ← word kind만
- pattern, explanation           ← grammar kind만
```

**장점**:
- 한 테이블로 검색·필터·정렬 단순
- 공통 작업(전체 카드 조회, 최신순 정렬) 빠름
- 새 종류 추가 시 컬럼만 추가

**단점**:
- 컬럼이 sparse (NULL 많음)
- 도메인 무결성 약함 (DB가 "이건 word니까 word/meaning 필수" 강제 못 함)
- 종류 늘어나면 컬럼 폭발

**언제 좋은가**: 종류 적고 안정적, 공통 작업 자주, 작은 팀

### 모델 B — 완전 분리 (Concrete Table Inheritance)

종류별로 테이블 따로.

```sql
word_cards: card_id, user_id, word, meaning, ...
grammar_cards: card_id, user_id, pattern, explanation, ...
sentence_cards: card_id, user_id, sentence, ...
```

**장점**:
- NULL 없음, 도메인 무결성 강함
- 종류별 독립 진화

**단점**:
- "모든 카드" 조회 시 UNION 필요
- 공통 컬럼(SRS, created_at) 중복 정의
- 페이지네이션 복잡

**언제 좋은가**: 종류가 본질적으로 다른 도메인, 도메인 무결성 엄격함 필수

### 모델 C — 하이브리드 (Class Table Inheritance)

공통 부모 테이블 + 종류별 자식 테이블.

```sql
study_items (부모): item_id, user_id, kind, SRS 컬럼, created_at
word_details (자식): item_id FK, word, meaning, thinking
grammar_details (자식): item_id FK, pattern, explanation
```

**장점**:
- 공통 컬럼 한 곳, 자식엔 NULL 없음
- "모든 카드" 부모만 조회

**단점**:
- 카드 한 장 조회 시 부모+자식 JOIN
- 카드 추가 시 2 INSERT (트랜잭션)

**언제 좋은가**: 공통 부분 크고, 종류별 특수 데이터도 풍부

### 모델 D — JSONB

종류별 데이터를 JSONB 컬럼에 통째 저장.

```sql
cards
- card_id, user_id, kind, SRS 컬럼
- details jsonb   ← kind별 구체 데이터
```

**장점**:
- 깔끔, 새 type 추가 시 ALTER 불필요
- 한 행에 모든 정보

**단점**:
- JSONB 안 데이터 무결성 강제 어려움
- JSONB 안 검색 시 GIN 인덱스 별도 필요
- 타입 안전성 떨어짐

**언제 좋은가**: 각 행의 모양이 유동적, 스키마를 강하게 못 정함

### 우리 앱 사례 — A + D 결합

cards는 통합 모델(A), 그 안의 thinking은 JSONB(D).
- 통합 모델 + CHECK 제약으로 무결성 보강
- thinking 배열은 그 단어와만 살고 검색 안 일어남 → JSONB 자연스러움
- 같은 type 항목 여러 개 표현 가능 (분리 컬럼이면 1NF 위반 불가피)

### 핵심 판단 기준

> "그 데이터가 **검색·집계 대상인가, 단순 표시 대상인가**"

검색·집계 → 분리 컬럼 (인덱싱, SQL 단순)
단순 표시 → JSONB (한 행 묶음, 가변 자유)

---

## 강의 5: 컬럼 타입 (PostgreSQL)

타입은 **도메인 무결성의 첫 방어선**. 잘 설계된 타입은 코드 버그 절반을 막아줌.

### 핵심 타입

| 카테고리 | 타입 | 쓰임 | 메모 |
|---|---|---|---|
| **식별자** | `uuid` | PK, FK — 추측 불가능한 글로벌 유일 ID | Supabase 권장. `gen_random_uuid()` 함수로 생성 |
| | `bigserial` | 자동 증가 정수 | 단순하지만 외부 노출 시 다음 ID 추측 가능 — 보안 약함 |
| **문자열** | `text` | 모든 가변 길이 문자열 | PostgreSQL에선 `text`와 `varchar(n)` 성능 동일 |
| **숫자** | `integer` | 32비트 정수 (-2.1B ~ 2.1B) | 일반 카운터 |
| | `bigint` | 64비트 정수 | 매우 큰 숫자 |
| | `numeric(p,s)` | 정확한 소수 | `numeric(5,2)` = 최대 999.99. 진척도·돈 |
| **시간** | `timestamptz` | 시간대 인식 timestamp | **항상 이거**. 시간대 정보 보존 |
| | `timestamp` | 시간대 무시 | 함정. 거의 안 씀 |
| | `date` | 날짜만 | 시간 정보 불필요 |
| **불리언** | `boolean` | true/false | NULL도 가능 (3-value 논리) |
| **JSON** | `jsonb` | 구조화된 JSON | binary, 압축, 인덱싱(GIN) |
| | `json` | 텍스트 JSON | 거의 안 씀, jsonb 권장 |
| **배열** | `type[]` | 같은 타입 여러 개 | 1NF 위반이지만 PostgreSQL 허용 |

### 함정 정리

**timestamptz vs timestamp**:
- `timestamp`는 시간대 정보를 버림. 한국 시간 저장 → 서버 UTC면 9시간 차이
- `timestamptz`는 UTC 저장 + 조회 시 원하는 시간대로 변환
- **거의 항상 timestamptz**

**uuid vs bigserial**:
- `bigserial`: 다음 ID 추측 가능 (1, 2, 3...) → 보안 약함
- `uuid`: 128비트 무작위, Supabase auth.users와 일관성
- **Supabase 환경에선 uuid 표준**

**text vs varchar(n)**:
- PostgreSQL에선 둘 다 성능 같음
- 길이 제한 필요하면 `CHECK (length(col) <= 100)` 추가
- **그냥 text 쓰기**

### Supabase의 auth.users 패턴

Supabase는 `auth.users` 테이블을 자동 관리:
- `id uuid` (PK)
- `email text` (NULL 가능)
- `is_anonymous boolean`
- `created_at timestamptz`
- 인증 관련 컬럼 다수

**선택지**:
- **(A) 별도 public.users 만들고 auth.users와 1:1**: 추가 컬럼 자유, 회원가입 trigger 필요
- **(B) auth.users 직접 참조**: 단순, 추가 컬럼 못 박음

→ **단순 앱은 (B), 복잡해지면 profiles 테이블 추가**

---

## 강의 6: 컬럼 제약 + CHECK 활용

타입이 "값의 모양", 제약은 "값의 규칙".

### 기본 제약

| 제약 | 의미 | 예시 |
|---|---|---|
| `NOT NULL` | NULL 불가 | `email text NOT NULL` |
| `NULL` | NULL 허용 (기본값) | `email text` |
| `DEFAULT` | 값 안 주면 이 값 | `created_at timestamptz DEFAULT now()` |
| `UNIQUE` | 중복 불가 | `book_hash text UNIQUE` |
| `PRIMARY KEY` | NOT NULL + UNIQUE + 인덱스 | `user_id uuid PRIMARY KEY` |
| `FOREIGN KEY ... REFERENCES` | 참조 무결성 | `user_id uuid REFERENCES users(user_id)` |
| `CHECK (조건)` | 사용자 정의 무결성 | `CHECK (progress_pct BETWEEN 0 AND 100)` |

### FK CASCADE 옵션

부모 행 삭제 시 자식 행 처리:

| 옵션 | 동작 |
|---|---|
| `ON DELETE CASCADE` | 자식도 같이 삭제 |
| `ON DELETE SET NULL` | 자식 FK를 NULL로 |
| `ON DELETE RESTRICT` | 자식 있으면 부모 삭제 거부 (기본) |
| `ON DELETE NO ACTION` | RESTRICT와 비슷 (트랜잭션 끝에 검증) |
| `ON DELETE SET DEFAULT` | 자식 FK를 기본값으로 |

선택 기준: 자식이 부모 없으면 의미 없으면 CASCADE, 자식 보존 필요하면 SET NULL/RESTRICT.

### CHECK 활용 — 도메인 무결성 보강

CHECK는 SQL의 함의(implication)를 표현하는 강력한 도구. 통합 모델에서 kind별 컬럼 강제하는 패턴:

```sql
-- "kind가 word이면, word/meaning은 NOT NULL이고 grammar 컬럼은 NULL이어야 한다"
CHECK (
  kind != 'word' OR (
    word IS NOT NULL AND meaning IS NOT NULL
    AND pattern IS NULL AND explanation IS NULL
  )
)
```

읽는 법: `A → B`(A이면 B)는 `NOT A OR B`. kind가 word가 아닐 땐 항상 통과, word일 때만 괄호 안 조건 강제.

이 패턴이 **통합 모델의 약점(도메인 무결성 약함)을 거의 완전히 보강**.

### CHECK 패턴들

```sql
-- 범위 제약
CHECK (progress_pct BETWEEN 0 AND 100)

-- enum 흉내 (PostgreSQL의 ENUM 대안)
CHECK (kind IN ('word', 'grammar'))

-- 시간 순서 강제
CHECK (ended_at IS NULL OR ended_at >= started_at)

-- 길이 제한
CHECK (length(title) BETWEEN 1 AND 500)

-- 정규식 매칭
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')

-- 다중 컬럼 조건
CHECK (
  (source = 'curated_free' AND created_by IS NULL)
  OR (source = 'user_upload' AND created_by IS NOT NULL)
)
```

### PostgreSQL ENUM vs text + CHECK

- **ENUM 타입**: `CREATE TYPE card_kind AS ENUM ('word', 'grammar')`. 값 추가/제거가 까다로움 (ALTER TYPE 복잡)
- **text + CHECK**: 자유도 높음, 값 추가 시 CHECK 제약만 ALTER. 권장

---

## 강의 7: 인덱스

### 인덱스 = 책의 색인

100만 행에서 "uncanny" 찾기:
- 인덱스 없이: 100만 행 풀스캔 (수초)
- 인덱스 있이: 트리 따라가 위치 바로 찾기 (1ms 미만)

1000~10000배 빨라질 수 있음.

### B-tree (PostgreSQL 기본)

균형 이진 트리. 정렬된 자료구조.

```
            [ M ]
           /     \
        [ G ]   [ T ]
        / \    /   \
     [ A ][ J ][ P ][ Z ]
```

100만 개 데이터도 약 20단계면 찾음 (log₂(1,000,000) ≈ 20).

**잘 동작**:
- 동등 비교: `WHERE col = ?`
- 범위 비교: `WHERE col > ?`, `WHERE col BETWEEN ? AND ?`
- 정렬: `ORDER BY col`
- LIKE 'prefix%' (앞 일치)

**잘 동작 안 함**:
- `WHERE col LIKE '%middle%'` (중간 일치 — 풀스캔)
- 함수 적용: `WHERE upper(col) = ?` (함수 인덱스 별도 필요)

### 인덱스 종류

| 종류 | 쓰임 |
|---|---|
| **B-tree** | 기본. 대부분의 경우 |
| **Hash** | 동등 비교만 — 거의 안 씀 (B-tree로 대체) |
| **GIN** | jsonb, 배열, 전문 검색 |
| **GiST** | 지리 데이터, 범위 타입 |
| **BRIN** | 매우 큰 테이블의 시간순 데이터 |

### 단일 vs 복합 인덱스

```sql
CREATE INDEX cards_user_idx ON cards (user_id);                 -- 단일
CREATE INDEX cards_user_book_idx ON cards (user_id, book_id);   -- 복합
```

**복합 인덱스의 컬럼 순서가 중요** — 사전 정렬 방식:
- "(성, 이름)" 정렬된 명부에서
- "김씨" 찾기: 빠름
- "김철수" 찾기: 빠름
- "철수" 찾기: 느림 (이름이 두 번째라 인덱스 못 씀)

### Left-prefix 원칙

복합 인덱스 `(A, B, C)`는:
- `WHERE A = ?` 쿼리 활용 가능
- `WHERE A = ? AND B = ?` 활용 가능
- `WHERE A = ? AND B = ? AND C = ?` 활용 가능
- `WHERE B = ?` 활용 **불가능**
- `WHERE A = ? AND C = ?` C 부분은 활용 못 함

### 컬럼 순서 결정 원칙

1. WHERE 절에 자주 등장하는 컬럼 먼저
2. 동등 비교(=) 컬럼이 범위 비교(<, >) 컬럼보다 먼저
3. 선택성(distinct value 다양성) 높은 컬럼 먼저

### 인덱스의 3가지 비용

1. **쓰기 느려짐**: INSERT/UPDATE/DELETE 시 인덱스도 갱신
2. **저장 공간 증가**: 보통 테이블 크기의 10~30%
3. **옵티마이저 혼란**: 인덱스 많으면 "어떤 인덱스 쓸지" 판단 시간 증가

→ **"필요한 만큼만" 원칙**. "혹시 모르니까" 안 만들기.

### 자동 인덱스

| 제약 | 자동 인덱스 |
|---|---|
| PRIMARY KEY | ✅ 자동 B-tree |
| UNIQUE | ✅ 자동 B-tree |
| FOREIGN KEY | ❌ **자동 X** (함정!) |

### FK 함정

PostgreSQL은 FK 컬럼에 자동 인덱스 만들지 않음. 결과:
- CASCADE delete 느려짐 (부모 삭제 시 자식 풀스캔)
- JOIN 느려짐

→ **모든 FK 컬럼에 명시적 인덱스** (대부분 복합 인덱스 첫 컬럼으로 자연 커버)

### 부분 인덱스 (Partial Index)

WHERE 조건 붙은 인덱스. 일부 행만 인덱싱.

```sql
CREATE INDEX cards_user_review_idx
  ON cards (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;
```

**장점**:
- 인덱스 크기 작음
- 갱신 비용 적음
- 옵티마이저가 매칭 쿼리에 활용

**활용 케이스**:
- "복습 일정 잡힌 카드만" — `WHERE next_review_at IS NOT NULL`
- "미종료 세션만" — `WHERE ended_at IS NULL`
- "활성 사용자만" — `WHERE deleted_at IS NULL`

### DESC 인덱스

```sql
CREATE INDEX cards_created_desc_idx ON cards (created_at DESC);
```

`ORDER BY created_at DESC` 쿼리 가속. `NULLS LAST` 같은 옵션도 가능.

### JSONB 인덱스 (GIN)

```sql
CREATE INDEX cards_thinking_gin_idx ON cards USING GIN (thinking);
```

jsonb 안의 키/값 검색 가속. 단순 표시 대상이라 검색 안 일어나면 인덱스 불필요.

### 인덱스 명명 규칙

`{테이블명}_{컬럼명}_{idx}` 패턴 통일. 부분 인덱스는 의미 라벨 추가 (`_review_idx`, `_unended_idx`).

---

## 강의 8: RLS (Row Level Security)

### 왜 RLS인가

전통 보안 패턴:
```
client → 백엔드 API → DB
              (백엔드가 user_id 필터링 추가)
```

문제: 백엔드 코드 버그 한 줄 → 전 사용자 데이터 노출. "1억 건 유출" 사고의 흔한 패턴.

RLS 패턴:
```
client → DB (RLS 정책으로 자동 필터)
```

DB가 직접 "이 행은 이 사용자에게만"을 강제. 백엔드가 `SELECT * FROM cards` 던져도 DB가 알아서 그 사용자 카드만 반환.

**RLS는 보안의 마지막 안전망** — 코드 버그·anon key 노출 다 막아줌.

### PostgreSQL RLS 작동 원리

**1단계 — RLS 켜기**
```sql
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
```
켜자마자 모든 쿼리 거부 (정책 없으면 모든 행 숨김 = 안전 기본값).

**2단계 — POLICY 정의** — 4가지 동작별로 각각

| 동작 | USING | WITH CHECK |
|---|---|---|
| SELECT | ✅ 필수 | ❌ 없음 |
| INSERT | ❌ 없음 | ✅ 필수 |
| UPDATE | ✅ 필수 | ✅ 필수 |
| DELETE | ✅ 필수 | ❌ 없음 |

- **USING**: "이 행이 보일/수정될 수 있는가?" (대상 행 필터)
- **WITH CHECK**: "이 행을 새로 추가/수정 결과로 가져도 되는가?" (쓰기 검증)

UPDATE에 둘 다 있는 이유: 사용자가 자기 행의 user_id를 다른 사람으로 바꿔 떠넘기는 공격 차단.

**3단계 — auth.uid() 함수** — 현재 인증된 사용자의 uuid 반환

### 단순 예시

```sql
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_select_own
  ON public.cards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY cards_insert_own
  ON public.cards FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

클라이언트가 `SELECT * FROM cards` 던지면 DB가 자동으로 `WHERE user_id = '현재 사용자 uuid'` 추가.

### Supabase 컨벤션

> **모든 public 스키마 테이블에 RLS 무조건 켜기.** 정책은 명시적으로 작성.

이유: Supabase는 anon key로 클라이언트가 직접 DB 접근. RLS 안 켜면 누구나 모든 행 접근 가능.

### 정책 분류

| 유형 | 패턴 |
|---|---|
| **개인 데이터** | `user_id = auth.uid()` (모든 작업) |
| **글로벌 읽기** | SELECT `USING (true)`, INSERT/UPDATE/DELETE는 인증·역할 제한 |
| **공유 데이터** | 더 복잡한 정책 (예: `EXISTS (SELECT 1 FROM team_members WHERE ...)`) |

### 권한 모델 (admin 처리)

| 옵션 | 방법 |
|---|---|
| **A. service_role key** | Supabase 자동 제공. 모든 RLS bypass. 백엔드/Dashboard에서만 사용 |
| **B. metadata role** | `auth.jwt() ->> 'role' = 'admin'` 정책 활용 |
| **C. 별도 admins 테이블** | `EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())` |

→ **소규모는 A로 충분**, admin UI 필요해지면 B/C

### 정책 테스트

```sql
-- 사용자 시뮬레이션
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO '사용자A-uuid';

SELECT * FROM public.cards;  -- 사용자 A 카드만 보여야 함

-- 정책 위반 시도
INSERT INTO public.cards (user_id, ...) VALUES ('다른사람-uuid', ...);
-- ERROR: new row violates row-level security policy

RESET role;
```

### 정책 점검 쿼리

```sql
-- 모든 RLS 정책 조회
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';

-- 어느 테이블에 RLS 켜져있나
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### 흔한 함정

1. **WITH CHECK 누락**: INSERT 정책에 빠뜨리면 user_id 우회 가능 → 항상 명시
2. **UPDATE WITH CHECK 누락**: 사용자가 user_id를 다른 사람으로 변경 가능 → 떠넘기기 공격
3. **service_role 노출**: 클라이언트/git에 노출되면 RLS 무력화. `.env` 관리, `.gitignore` 필수
4. **정책 무한 재귀**: 한 정책이 다른 테이블 SELECT 조건으로 사용되는데 그 테이블 정책이 다시 첫 테이블 참조 → 모든 쿼리 에러. **정책은 단순하게 유지**
5. **익명 사용자 무시**: Supabase 익명 인증 시 auth.uid() 반환 정상. "익명만 차단" 원하면 `(auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE` 활용

### USING vs WITH CHECK 차이

```sql
-- USING만 — 자기 행만 수정 가능
CREATE POLICY cards_update_own
  ON public.cards FOR UPDATE
  USING (user_id = auth.uid());

-- 위 정책으로 가능: 자기 행의 user_id를 다른 사람으로 UPDATE → 떠넘기기 성공!

-- USING + WITH CHECK — 수정 후에도 자기 행이어야
CREATE POLICY cards_update_own
  ON public.cards FOR UPDATE
  USING (user_id = auth.uid())          -- 수정 대상 행 필터
  WITH CHECK (user_id = auth.uid());    -- 수정 결과 행 검증
```

---

## 강의 9: 시드 데이터 + Supabase 운영

### 시드 데이터란

앱 처음 켰을 때 DB에 미리 깔려있어야 하는 기본 데이터.

가치:
1. **빈 화면 회피**: 첫 사용자 이탈 방지
2. **사용 경로 제시**: "이런 식으로 쓰는구나" 학습 샘플

### 시드 데이터 두 구성

```
시드 데이터
├── 메타데이터 (DB 테이블 행)
└── 파일/리소스 (Storage)
```

우리 앱: books 메타데이터 + EPUB 파일.

### 시드 깔기 방법

| 방법 | 장점 | 단점 |
|---|---|---|
| **A. Dashboard SQL Editor 수동** | 단순, 인프라 0 | 책 수 늘면 관리 어려움 |
| **B. 운영 스크립트** | Git 관리, 코드처럼 시드 다룸 | 스크립트 작성 필요 |
| **C. Supabase Migrations** | 스키마 변경과 같은 흐름 | 학습 곡선 |

### Idempotent 운영 스크립트 패턴

같은 스크립트 N번 실행해도 결과 같음 = idempotent. 안전한 운영.

핵심: **이미 있는 행은 skip 또는 update**.

```js
// service_role key로 RLS bypass
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

for (const book of curatedBooks) {
  const hash = computeHash(book.epubFile);

  // UPSERT 패턴 — 중복 시 기존 행 재사용
  const { data } = await supabase
    .from('books')
    .upsert(
      { title, author, book_hash: hash, source: 'curated_free' },
      { onConflict: 'book_hash', ignoreDuplicates: true }
    )
    .select('book_id')
    .single();

  // Storage 업로드 (upsert: false로 기존 파일 보호)
  await supabase.storage
    .from('curated_books')
    .upload(`${data.book_id}.epub`, book.epubFile, { upsert: false });
}
```

### UPSERT (ON CONFLICT)

PostgreSQL 9.5+의 강력한 패턴. "있으면 update, 없으면 insert":

```sql
INSERT INTO books (title, author, book_hash, source)
VALUES (?, ?, ?, 'user_upload')
ON CONFLICT (book_hash) DO NOTHING
RETURNING book_id;

-- 또는 update
INSERT INTO books (title, author, book_hash, source)
VALUES (?, ?, ?, 'user_upload')
ON CONFLICT (book_hash) DO UPDATE
SET title = EXCLUDED.title  -- EXCLUDED는 INSERT 시도한 값
RETURNING book_id;
```

Supabase 클라이언트:
```js
.upsert({...}, { onConflict: 'book_hash', ignoreDuplicates: true })
```

### Supabase Storage

파일 저장소 (S3 같은). 버킷 단위로 관리.

```js
// 업로드
await supabase.storage
  .from('curated_books')
  .upload(`${book_id}.epub`, fileData, {
    contentType: 'application/epub+zip',
    upsert: false  // 기존 파일 덮어쓰기 X
  });

// 다운로드 URL
const { data } = await supabase.storage
  .from('curated_books')
  .getPublicUrl(`${book_id}.epub`);
```

### Storage RLS

Storage도 RLS 정책 가능. 비슷한 패턴:
```sql
CREATE POLICY "user_uploads_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user_uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Git 기반 시드 관리

```
seeds/
├── curated_books.json          ← 책 목록 (메타데이터)
├── epubs/                      ← 파일들
│   ├── book1.epub
│   └── ...
└── seed.js                     ← service_role로 INSERT + Storage
```

운영자 흐름:
1. 새 책 EPUB을 `seeds/epubs/`에 추가
2. `curated_books.json`에 항목 추가
3. `node seeds/seed.js` 실행
4. Git commit (변경 기록)

**같은 스크립트 재실행 안전** = idempotent.

---

## 용어 사전

### 모델링 기본

| 한글 | 영문 | 정의 |
|---|---|---|
| 엔티티 | Entity | 정보를 저장하고 싶은 독립된 사물/개념. 보통 1 엔티티 = 1 테이블 |
| 속성 | Attribute | 엔티티의 특성. 테이블에서 컬럼 |
| 관계 | Relationship | 두 엔티티가 어떻게 묶이는지 |
| 도메인 | Domain | 속성의 값 허용 범위 |
| 스키마 | Schema | DB 전체 구조 설계도 |
| ERD | Entity-Relationship Diagram | 엔티티·관계 그림 |

### 테이블 구조

| 한글 | 영문 | 학술 용어 |
|---|---|---|
| 테이블 | Table | 릴레이션 (Relation) |
| 행/로우 | Row | 튜플 (Tuple) / 레코드 (Record) |
| 열/컬럼 | Column | 속성 (Attribute) / 필드 (Field) |
| 셀 | Cell | (없음) |

학술 용어 ↔ 실무 용어 ↔ 프레임워크 용어가 누적된 결과. 다 같은 것.

### 테이블 모델 패턴

| 한글 | 영문 | 정의 |
|---|---|---|
| 통합 모델 | Single Table Inheritance | 한 테이블에 모든 종류, kind 컬럼으로 구분 |
| 완전 분리 | Concrete Table Inheritance | 종류별로 테이블 따로 |
| 하이브리드 | Class Table Inheritance | 공통 부모 + 종류별 자식 테이블 |
| EAV | Entity-Attribute-Value | 속성 자체를 행으로 저장 — 극단적 유연성, 거의 안 씀 |
| Sparse 컬럼 | Sparse Columns | NULL이 많은 컬럼들 |

### 키

| 한글 | 영문 | 정의 |
|---|---|---|
| 기본키 | Primary Key (PK) | 행을 유일 식별. NULL 불가, 중복 불가 |
| 외래키 | Foreign Key (FK) | 다른 테이블의 PK를 가리키는 컬럼 |
| 복합키 | Composite Key | 둘 이상의 컬럼을 묶어 만든 키 |
| 후보키 | Candidate Key | PK 자격 컬럼 (중 하나를 PK로 선택) |
| 대체키 | Alternate Key | 후보키 중 PK로 안 뽑힌 것 |
| 슈퍼키 | Super Key | 행 식별 가능한 모든 컬럼 조합 (후보키의 상위) |
| 자연키 | Natural Key | 도메인에 자연스럽게 존재하는 키 (예: book_hash) |
| 대리키 | Surrogate Key | 식별 위해 인위적으로 만든 키 (예: 자동 증가 ID) |

실무에선 PK, FK, 복합키만 알아도 90% 커버.

### 관계

| 한글 | 영문 | 정의 |
|---|---|---|
| 카디널리티 | Cardinality | 관계 형태(1:1/1:N/N:M) 또는 테이블 행 수 |
| 일대일 | One-to-One (1:1) | 한 행 ↔ 한 행 |
| 일대다 | One-to-Many (1:N) | 한 행 ↔ 여러 행 |
| 다대다 | Many-to-Many (N:M) | 양쪽 모두 여러 행 |
| 중간 테이블 | Junction / Bridge / Associative Table | N:M 해소용 |
| 참조 | Reference | FK로 가리키는 행위 |
| 참조 무결성 | Referential Integrity | FK가 가리키는 PK가 반드시 존재 |
| CASCADE | Cascade | 부모 삭제 시 자식 같이 삭제 (FK 옵션) |
| SET NULL | Set Null | 부모 삭제 시 자식 FK NULL로 |
| RESTRICT | Restrict | 자식 있으면 부모 삭제 거부 (기본) |

### 정규화

| 한글 | 영문 | 정의 |
|---|---|---|
| 정규화 | Normalization | 중복·이상현상 제거 위한 분해 과정 |
| 정규형 | Normal Form (NF) | 정규화 단계 (1NF~5NF) |
| 함수적 종속성 | Functional Dependency (FD) | "A → B" 결정 관계 |
| 부분 종속 | Partial Dependency | 복합키 일부에만 종속 (2NF 위반) |
| 이행적 종속 | Transitive Dependency | `A → B → C` 구조 (3NF 위반) |
| 이상현상 | Anomaly | 잘못된 스키마로 인한 불합리한 동작 |
| 반정규화 | Denormalization | 성능 위해 정규화 깨기 |

### 무결성 (4종)

| 한글 | 영문 | 의미 |
|---|---|---|
| 엔티티 무결성 | Entity Integrity | PK는 NULL/중복 불가 |
| 참조 무결성 | Referential Integrity | FK가 가리키는 PK 반드시 존재 |
| 도메인 무결성 | Domain Integrity | 컬럼 값이 타입·범위 안 |
| 사용자 정의 무결성 | User-defined Integrity | 비즈니스 규칙 제약 (CHECK) |

### PostgreSQL 타입

| 타입 | 의미 |
|---|---|
| `uuid` | 128비트 UUID. `gen_random_uuid()`로 생성 |
| `text` | 가변 길이 문자열 (varchar 대체) |
| `integer`, `bigint` | 정수 (32/64비트) |
| `numeric(p,s)` | 정확한 소수 (p자리, 그중 소수 s자리) |
| `real`, `double precision` | 부동소수 (정확도 떨어짐, 돈 같은 데이터엔 numeric 권장) |
| `timestamptz` | 시간대 인식 timestamp (UTC 저장) |
| `timestamp` | 시간대 무시 (함정, 거의 안 씀) |
| `date` | 날짜만 |
| `boolean` | true/false |
| `jsonb` | binary JSON (압축, 인덱싱) |
| `json` | text JSON (jsonb로 대체) |
| `type[]` | 같은 타입 배열 |

### 제약

| 한글 | 영문 | 의미 |
|---|---|---|
| NOT NULL | NOT NULL | NULL 불가 |
| 기본값 | DEFAULT | 값 안 줄 때 사용할 값 |
| 유니크 | UNIQUE | 중복 불가 |
| 체크 | CHECK | 사용자 정의 조건 |
| 생성 컬럼 | Generated Column | 다른 컬럼에서 자동 계산 |

### 인덱스

| 한글 | 영문 | 의미 |
|---|---|---|
| 인덱스 | Index | 컬럼의 "찾기 빠른 자료구조" |
| B-tree | B-tree | 균형 이진 트리. PostgreSQL 기본 |
| GIN | Generalized Inverted Index | jsonb, 배열, 전문 검색용 |
| GiST | Generalized Search Tree | 지리 데이터, 범위 타입용 |
| Hash | Hash Index | 동등 비교만. 거의 안 씀 |
| BRIN | Block Range Index | 매우 큰 시간순 데이터 |
| 단일 인덱스 | Single-column Index | 한 컬럼만 |
| 복합 인덱스 | Composite / Multicolumn Index | 여러 컬럼 묶음 |
| 부분 인덱스 | Partial Index | WHERE 조건 붙은 인덱스 |
| 함수 인덱스 | Functional / Expression Index | 컬럼에 함수 적용한 결과 인덱싱 |
| Left-prefix | Left-prefix 원칙 | 복합 인덱스는 앞 컬럼부터 활용 가능 |
| 선택성 | Selectivity | distinct value 다양성. 높을수록 인덱스 효과 큼 |
| 풀스캔 | Full Table Scan | 인덱스 없이 모든 행 훑기 |

### 보안/접근

| 한글 | 영문 | 의미 |
|---|---|---|
| RLS | Row Level Security | 행 단위 보안 — 특정 사용자가 특정 행만 접근 |
| 정책 | Policy | RLS의 구체 규칙 |
| USING | USING (절) | 대상 행 필터 (SELECT/UPDATE/DELETE) |
| WITH CHECK | WITH CHECK (절) | 쓰기 결과 행 검증 (INSERT/UPDATE) |
| auth.uid() | auth.uid() | Supabase 함수 — 현재 인증 사용자 uuid |
| anon key | Anon Key | 공개 가능한 클라이언트 key. RLS 적용 |
| service_role | Service Role Key | 비밀 key. 모든 RLS bypass |
| 익명 인증 | Anonymous Authentication | 회원가입 없이 임시 user_id 부여 |
| 트랜잭션 | Transaction | 여러 SQL을 한 묶음으로 — 다 되거나 다 안 되거나 |
| ACID | Atomicity, Consistency, Isolation, Durability | 트랜잭션의 4대 보장 |

### 저장소 종류

| 한글 | 영문 | 예시 |
|---|---|---|
| RDBMS | Relational Database Management System | PostgreSQL, MySQL, Oracle, SQLite |
| KV | Key-Value Store | Redis, LocalStorage |
| 문서 DB | Document DB | MongoDB, Firestore |
| 그래프 DB | Graph DB | Neo4j |
| BaaS | Backend-as-a-Service | Supabase, Firebase |
| Object Storage | Object Storage | Supabase Storage, AWS S3 |

### 운영

| 한글 | 영문 | 의미 |
|---|---|---|
| 마이그레이션 | Migration | 스키마 변경을 코드로 관리·적용 |
| 시드 데이터 | Seed Data | 앱 처음 켤 때 깔아두는 기본 데이터 |
| UPSERT | UPSERT (ON CONFLICT) | INSERT 또는 UPDATE — 충돌 시 처리 |
| Idempotent | Idempotent | 같은 작업 N번 해도 결과 같음 |
| Edge Function | Edge Function | Supabase의 서버리스 함수 |
| pg_cron | pg_cron Extension | PostgreSQL 안에서 cron job |
| materialized view | Materialized View | 비싼 집계 결과 미리 계산해서 저장 |
| 생성 컬럼 | Generated Column | 다른 컬럼에서 자동 계산되는 컬럼 |

### 기타

| 한글 | 영문 | 의미 |
|---|---|---|
| JOIN | Join | 두 테이블을 FK 기준으로 연결해서 조회 |
| INNER JOIN | Inner Join | 양쪽 다 매칭되는 행만 |
| LEFT JOIN | Left Outer Join | 왼쪽 모든 행 + 매칭되는 오른쪽 |
| UNION | Union | 두 결과 집합 합치기 |
| 쿼리 | Query | DB에 던지는 요청 (SQL 문) |
| 단일 출처 | Single Source of Truth (SSoT) | 같은 정보는 한 곳에만 |
| 중복 | Redundancy | 같은 정보가 여러 곳에 — 일반적으로 나쁨 |
| 온톨로지 | Ontology | 개념들의 의미적 관계를 형식 정의한 모델 |
| 옵티마이저 | Query Planner / Optimizer | DB의 쿼리 실행 계획 결정 엔진 |
| EXPLAIN | EXPLAIN | 쿼리 실행 계획 조회 (인덱스 활용 여부 등 확인) |

---

## 살짝 짚어둘 직관 (자주 하는 오해)

### "테이블 간 위계질서"는 정확한 표현이 아님

- 관계형 모델 ≠ 계층형 모델 (계층형 DB는 IBM IMS 같은 다른 패러다임)
- 관계형은 평평한 격자들의 집합. FK는 참조 방향만 가짐
- "상위/하위" 대신 "부모/자식" 또는 "참조한다"가 정확
- 한 자식이 두 부모를 가질 수도 있음 (우리 앱의 cards는 users·books 둘 다 참조)

### 컬럼 순서는 의미 없음 (단, 인덱스는 예외)

- 이론적으로 "관계는 순서 없는 속성 집합"
- 직관적 정리(관련 컬럼 모아두기)는 인간의 편의일 뿐
- 잡탕 테이블의 진짜 죄는 "컬럼 순서 엉망"이 아니라 "그 컬럼들이 한 테이블에 같이 있다는 사실 자체"
- **예외**: 복합 인덱스의 컬럼 순서는 중요 (left-prefix 원칙)

### 한 줄짜리 표도 테이블

- 테이블 본질은 행/열 개수가 아니라 "어떤 종속 관계를 표현하느냐"
- 0행 0열도 테이블

### 온톨로지는 관계형 DB의 확장이 아님

- 관계형 FK = "가리킨다" (의미 라벨 없음)
- 온톨로지 = 의미 라벨 있는 엣지 (isA, partOf, authored 등)
- 의료·법률·지식그래프처럼 의미가 협상 대상인 도메인에 진가
- 우리 앱처럼 도메인 명확한 곳엔 오버킬

### NULL의 의미는 모호

- "값이 없다" / "모른다" / "해당 없음" 모두 NULL로 표현됨
- 좋은 스키마는 NULL이 의미를 명확히 가지도록 설계
- 잡탕 테이블에서 NULL이 많아진다 → 모델 분리 신호
- 통합 모델에선 CHECK 제약으로 NULL 의미 강제 가능

### timestamptz를 항상 쓰자

- `timestamp`는 시간대 정보를 버려 한국 시간 ↔ UTC 차이 9시간 함정
- `timestamptz`는 UTC 저장 + 조회 시 변환
- 거의 항상 timestamptz, 예외는 "달력 날짜"처럼 시간대 의미 없을 때

### text vs varchar(n) 고민하지 말기

- PostgreSQL에선 둘 다 성능 같음
- 길이 제한 정말 필요하면 `CHECK (length(col) <= 100)` 추가
- 기본은 `text`

### JSONB는 1NF 위반의 명시적 허용

- 이론적으론 JSONB 안의 배열 = 1NF 위반
- 하지만 PostgreSQL JSONB는 일급 시민 — 인덱싱(GIN), 안의 필드 조회 다 지원
- 그 데이터가 **검색·집계 대상이 아니라 단순 표시 대상**이면 JSONB가 자연스러움
- 분리 컬럼이 항상 옳은 게 아님

### 통합 모델의 sparse 컬럼은 작은 도메인엔 무방

- 종류 2~3개에 컬럼 5~10개 sparse 정도면 통합이 압도적으로 단순
- 도메인 무결성 약함은 **CHECK 제약**으로 거의 완전히 보강 가능
- 종류가 10개 이상으로 늘어나거나 종류가 본질적으로 다른 도메인이면 분리/하이브리드

### 인덱스는 공짜가 아니다

- 쓰기 비용 증가 (INSERT/UPDATE/DELETE 시 인덱스 갱신)
- 저장 공간 (테이블 크기의 10~30%)
- 옵티마이저 혼란 (많을수록 선택 시간 증가)
- → "필요한 만큼만". 진짜 쿼리 느릴 때 추가

### FK 컬럼은 자동 인덱스 안 만들어줌 (PostgreSQL 함정)

- PRIMARY KEY와 UNIQUE만 자동 인덱스
- FK는 부모 PK 인덱스만 자동 생성. 자식 FK 컬럼은 X
- → CASCADE delete·JOIN 느릴 수 있음. 명시적으로 인덱스 만들기

### RLS는 보안의 마지막 안전망

- 코드에 버그 있어도, anon key 노출돼도, 사용자가 SQL 직접 던져도
- RLS 정책이 통과시키지 않은 행은 절대 안 나옴
- 단, **service_role key는 RLS bypass** — 노출 시 무력화

### service_role 노출 = RLS 무력화

- 클라이언트/git에 service_role 박으면 누구나 모든 데이터 접근 가능
- `.env` 관리, `.gitignore` 명시, GitHub secret scanning 활용
- 노출 발견 시 즉시 Supabase Dashboard에서 key 재발급

### "정규화는 옳다, 다만 항상 옳진 않다"

- 3NF까지 가는 게 표준
- 성능 위해 의도적 반정규화 OK — 동기화 책임만 명확히
- 카운터 컬럼, last_opened_at 같은 패턴
- **정규화에 도그마틱하지 말 것**

### "이게 derived data인가?"가 좋은 질문

- COUNT(*), SUM, max() 같은 집계 결과를 따로 저장하려 할 때
- 원본에서 계산 가능하면 보통 저장 X (쿼리로 충분)
- 진짜 느린 경우만 materialized view 또는 카운터 컬럼

---

## v3+ 다음 단계 (학습 예정)

이번 v2 강의에서 다루지 않았지만 앞으로 만나게 될 주제:

- [ ] **JOIN의 종류와 활용** (INNER, LEFT, RIGHT, FULL, CROSS, LATERAL)
- [ ] **트랜잭션 / ACID** 깊이 (격리 수준, 데드락, 낙관/비관 락)
- [ ] **EXPLAIN으로 쿼리 분석** (실행 계획 읽기, 인덱스 활용 검증)
- [ ] **마이그레이션 관리** (Supabase migrations, 다운/업 스크립트, 무중단 배포)
- [ ] **PostgreSQL 고급 기능**
  - Window 함수 (LAG, LEAD, ROW_NUMBER 등)
  - CTE (Common Table Expression, WITH 절)
  - Recursive CTE (계층 구조 쿼리)
- [ ] **전문 검색** (Full-text search, tsvector, tsquery)
- [ ] **pgvector + 임베딩** (AI 추천 시스템용)
- [ ] **Realtime / Subscriptions** (Supabase 실시간 기능)
- [ ] **Edge Functions** (Deno 기반 서버리스)
- [ ] **백업/복원 정책**
- [ ] **모니터링과 알림** (slow query log, Supabase 로그)
