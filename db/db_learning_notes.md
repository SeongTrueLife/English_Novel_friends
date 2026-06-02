# DB 학습 노트

작성: 2026-06-01
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
- 의도적 선택. 인덱스 강의 즈음 같이 다룰 토픽

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

### 키

| 한글 | 영문 | 정의 |
|---|---|---|
| 기본키 | Primary Key (PK) | 행을 유일 식별. NULL 불가, 중복 불가 |
| 외래키 | Foreign Key (FK) | 다른 테이블의 PK를 가리키는 컬럼 |
| 복합키 | Composite Key | 둘 이상의 컬럼을 묶어 만든 키 |
| 후보키 | Candidate Key | PK 자격 컬럼 (중 하나를 PK로 선택) |
| 대체키 | Alternate Key | 후보키 중 PK로 안 뽑힌 것 |
| 슈퍼키 | Super Key | 행 식별 가능한 모든 컬럼 조합 (후보키의 상위) |

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

### 저장소 종류

| 한글 | 영문 | 예시 |
|---|---|---|
| RDBMS | Relational Database Management System | PostgreSQL, MySQL, Oracle, SQLite |
| KV | Key-Value Store | Redis, LocalStorage |
| 문서 DB | Document DB | MongoDB, Firestore |
| 그래프 DB | Graph DB | Neo4j |
| BaaS | Backend-as-a-Service | Supabase, Firebase |

### 보안/접근 (앞으로 강의 예정)

| 한글 | 영문 | 의미 |
|---|---|---|
| RLS | Row Level Security | 행 단위 보안 — 특정 사용자가 특정 행만 접근 |
| 정책 | Policy | RLS의 구체 규칙 |
| 익명 인증 | Anonymous Authentication | 회원가입 없이 임시 user_id 부여 |
| 트랜잭션 | Transaction | 여러 SQL을 한 묶음으로 — 다 되거나 다 안 되거나 |
| ACID | Atomicity, Consistency, Isolation, Durability | 트랜잭션의 4대 보장 |

### 기타

| 한글 | 영문 | 의미 |
|---|---|---|
| 인덱스 | Index | 컬럼에 미리 만들어둔 "찾기 빠른 자료구조". 책의 색인 |
| JOIN | Join | 두 테이블을 FK 기준으로 연결해서 조회 |
| 쿼리 | Query | DB에 던지는 요청 (SQL 문) |
| 마이그레이션 | Migration | 스키마 변경을 코드로 관리·적용 |
| 시드 데이터 | Seed Data | 앱 처음 켤 때 깔아두는 기본 데이터 |
| 단일 출처 | Single Source of Truth (SSoT) | 같은 정보는 한 곳에만 |
| 중복 | Redundancy | 같은 정보가 여러 곳에 — 일반적으로 나쁨 |
| 온톨로지 | Ontology | 개념들의 의미적 관계를 형식 정의한 모델 |

---

## 살짝 짚어둘 직관 (자주 하는 오해)

### "테이블 간 위계질서"는 정확한 표현이 아님

- 관계형 모델 ≠ 계층형 모델 (계층형 DB는 IBM IMS 같은 다른 패러다임)
- 관계형은 평평한 격자들의 집합. FK는 참조 방향만 가짐
- "상위/하위" 대신 "부모/자식" 또는 "참조한다"가 정확
- 한 자식이 두 부모를 가질 수도 있음 (우리 앱의 cards는 users·books 둘 다 참조)

### 컬럼 순서는 의미 없음

- 이론적으로 "관계는 순서 없는 속성 집합"
- 직관적 정리(관련 컬럼 모아두기)는 인간의 편의일 뿐
- 잡탕 테이블의 진짜 죄는 "컬럼 순서 엉망"이 아니라 "그 컬럼들이 한 테이블에 같이 있다는 사실 자체"

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

---

## 앞으로 추가될 것

- [ ] 컬럼 타입 설계 (PostgreSQL 타입 시스템 — `uuid`, `text`, `timestamptz`, `jsonb`, `numeric` 등)
- [ ] CHECK 제약 (사용자 정의 무결성)
- [ ] 인덱스 — B-tree, Hash, GIN, 복합 인덱스
- [ ] JOIN의 종류 (INNER, LEFT, RIGHT, FULL, CROSS)
- [ ] 트랜잭션 / ACID
- [ ] 반정규화 패턴
- [ ] RLS (Row Level Security) 정책 작성
- [ ] 마이그레이션 관리 (Supabase migrations)
- [ ] 통합 vs 분리 vs 하이브리드(상속) 테이블 패턴
