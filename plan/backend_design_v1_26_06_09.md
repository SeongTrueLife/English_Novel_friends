# Backend Design v1 — SentenceMate Reader (현재 정본)

작성: 2026-06-09
상태: **현재 정본 (current)** — 백엔드 아키텍처(데이터 주고받기) 설계
상위 문서: [plan_v3_26_06_09.md](plan_v3_26_06_09.md) — "남은 설계 작업 > A. 백엔드 아키텍처"의 산출물

관련 정본 문서:

- [plan_v3_26_06_09.md](plan_v3_26_06_09.md) — 계획 정본 (결정·맥락)
- [../db/db_schema_v2.md](../db/db_schema_v2.md) — **DB 스키마 정본** (테이블·인덱스·RLS·트리거·시드). 본 설계로 `ai_usage` 추가 → **v2.1**
- [../SystemPrompt/system_prompt_v3_final_en.md](../SystemPrompt/system_prompt_v3_final_en.md) — 시스템 프롬프트 정본 (Edge Function이 ingest)

> **이 문서의 역할**: DB 스키마는 *"데이터를 어떻게 저장하나"*를 다뤘고, 이 문서는 그 위에서 **"데이터를 어떻게 주고받나"**(키 전략·인증·접근 계층·Storage·에러/레이트)를 못 박는다. 화면(상태관리·라우팅·렌더)은 프론트엔드 영역이라 제외 — 다음 프론트 채팅.

---

## 0. 한눈에 — 확정된 갈림길

| 항목 | 결정 | 한 줄 이유 |
| --- | --- | --- |
| **① Gemini 키** | **B. Edge Function 프록시** (운영자 키 1개, 서버 경유) + **일일 쿼터** | 배포 endgame은 일반 사용자 → BYO(본인 키)는 진입장벽 치명적. 키를 클라에 두면 노출되므로 공유 키는 반드시 서버 경유 |
| **C(본인 키 옵션)** | **나중에 증축** (MVP 제외) | B 위에 `if(userKey)` 분기 + 설정 UI만 추가 = 갈아엎기 아님 |
| **② 인증** | 익명 부팅 시작 + 이메일/비번 가입(Confirm 끔) + linkIdentity | 초기 장벽 0 + 가입 유도(모델 2) + user_id 유지 |
| **③ 데이터 접근** | service layer (도메인별 파일) + throw 컨벤션 | 쿼리 한 곳 관리·교체·테스트, 컴포넌트는 백엔드에 무지 |
| **④ Storage** | `curated_books` **Public 버킷** | 저작권 free 책이라 숨길 이유 없음. 단순·CDN |
| **⑤ 에러/레이트** | 에러 코드 계약 + 1회 재시도 + 일일 쿼터 100회 | 폭주 차단 목적, 정밀 레이트리밋은 오버킬 |

---

## ① Gemini API 키 전략 — B (Edge Function 프록시)

### 결정 배경 (왜 B인가)

브라우저로 내려간 모든 것(번들·localStorage·네트워크 탭)은 사용자가 들여다볼 수 있다. 따라서:

- **운영자 공유 키를 클라이언트에 심는 것은 불가능** — 노출 즉시 결제 폭탄. "공유 키 = 반드시 서버 경유"는 취향이 아니라 보안 사실.
- **각자 본인 키(A)** 는 서버 0이지만, 일반 사용자에게 "Google Cloud 키 발급"은 앱을 안 쓰게 만드는 벽 → 배포 endgame과 충돌.

→ **B: 브라우저는 Gemini를 직접 안 부르고, Supabase Edge Function을 부른다. 그 함수가 서버에 숨긴 운영자 키로 Gemini를 대신 호출.**

```
브라우저 → [Edge Function: JWT검증 → 쿼터체크 → Gemini호출 → JSON검증] → v3 JSON
              (운영자 키 = 서버에만 존재, 클라엔 절대 안 내려감)
```

### B의 부가 이득

- 시스템 프롬프트 v3가 **클라에 노출 안 됨** (서버에만) → 자산 보호
- 프롬프트·responseSchema를 **중앙에서 교체** → 앱 재배포 없이 함수만 갱신
- 호출 비용·레이트를 운영자가 통제

### C(본인 키)를 나중에 쉽게 만드는 3가지 배려 (지금 비용 0)

1. Edge Function이 Gemini 키를 **변수로** 받게: `const apiKey = userKey ?? OPERATOR_KEY` 자리만 비워둠. 키를 코드 중간에 하드코딩 금지.
2. **쿼터 체크를 독립 단계로** 분리 → 나중에 "userKey 있으면 skip" 끼우기 쉽게.
3. 클라의 AI 호출을 **service layer 한 함수(`askAI`)로** 감싸기 → UI는 키 출처를 모름.

> B → C는 "이미 선 서버 안에 분기 하나 추가"라 **증축**이지 갈아엎기가 아니다. MVP 후 필요 시 반나절.

---

## ② 인증 플로우 — 익명 시작 + 가입 유도(모델 2)

### 큰 그림

```
앱 첫 진입
  └─ 세션 있나? ──아니오──> supabase.auth.signInAnonymously()  (부팅 시 자동)
       │  예                    → 익명 user_id(uuid) + JWT 발급, localStorage 자동 저장
       ▼
  세션 복원 + 토큰 자동 갱신(supabase-js 기본: persistSession + autoRefreshToken)
       │
       ├─ [DB]  supabase.from('cards')...        → 토큰 자동 첨부 → RLS가 auth.uid()로 본인 행만
       └─ [AI]  supabase.functions.invoke('ask-ai') → 토큰 자동 첨부 → Edge Function이 getUser()로 검증
       │
       ▼ (사용자가 원할 때, 가입 유도)
  이메일/비번 연결  supabase.auth.updateUser({email,password})  → 같은 user_id 유지, 데이터 그대로 승계 (linkIdentity는 OAuth 전용)
```

### 결정 4가지

| 항목 | 결정 | 비고 |
| --- | --- | --- |
| **익명 트리거 시점** | **부팅 시 자동**(옵션 1) | 라이브러리·진행·세션이 다 user_id에 매달려 lazy의 이득 없음 |
| **세션/토큰 갱신** | supabase-js 기본값 그대로 | `persistSession: true, autoRefreshToken: true` 확인만. 직접 짤 것 없음 |
| **가입 식별자** | **이메일+비번, "Confirm email" 켬(링크 방식)** (2026-06-19 갱신) | 오타 이메일로 비번 복구 불가 사태 방지 위해 소유 증명 필요. 확인 링크 클릭 후 타기기 로그인 활성. (초기엔 "끔=가벼움"이었으나 **데이터 안전 우선**으로 변경.) 50개 자동 가입유도 팝업도 제외 → 설명 페이지+비강요 진입(frontend_plan §6.9) |
| **익명→가입** | **`updateUser({email,password})`** 로 user_id 유지 (**모델 2**) | 익명 데이터 그대로 승계, 마이그레이션 0. ※ `linkIdentity`는 OAuth(소셜) 전용 — 이메일/비번엔 `updateUser`가 정답(2026-06-19 정정) |

### 익명 인증의 핵심 함정 (이메일 연결의 "왜")

익명 user의 정체성은 **localStorage의 refresh token 하나**에만 걸려 있다. 이걸 잃으면 데이터는 클라우드에 살아있지만 **"내 것이라 증명할 열쇠"를 잃어** 새 익명 user가 발급되고 옛 데이터는 유령이 된다.

**refresh token을 잃는 경우**: 브라우저 사이트 데이터 삭제 / 시크릿 모드 / **다른 단말기·브라우저**(원천적 공유 불가) / **iOS Safari 7일 규칙(ITP)** — 7일 미방문 시 자동 삭제 / 명시적 로그아웃.

→ `linkIdentity`로 이메일을 붙이면 **localStorage와 무관한 영구 열쇠**가 생겨, 저장소가 날아가도/다른 단말기여도 **이메일로 재로그인 시 같은 user_id 복귀** → 데이터 귀환. 이것이 plan_v3의 "단말기 간 sync"가 성립하는 전제다.

- **PWA로 설치**하면 iOS 7일 규칙이 완화됨 → plan_v3 K(배포 직전 PWA)가 여기서 재정당화.
- 가입 안내(캐시 삭제 시 데이터 유실 경고 페이지/문구)는 **프론트 영역** → 다음 단계.

### Edge Function JWT 검증 (보안의 핵심)

`functions.invoke()`는 현재 세션 JWT를 Authorization 헤더에 자동 첨부. 함수 안에서:

```ts
const authHeader = req.headers.get('Authorization')          // "Bearer <jwt>"
const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
})
const { data: { user } } = await supabase.auth.getUser()     // 토큰 검증 + user 추출
if (!user) return new Response('Unauthorized', { status: 401 })
// 이제 user.id로 쿼터 체크 → Gemini 호출
```

토큰 없음/위조면 `getUser()`가 null → 401. 이 한 블록이 "아무나 운영자 키로 Gemini 못 씀"을 보장. (익명 토큰도 통과해야 하므로 함수 안 검증 기준.)

### MVP 제외 (나중에)

profiles 테이블, 인구통계(나이/성별), 가입 안내 페이지, Google OAuth. 전부 **나중에 추가해도 갈아엎기 아님** (profiles는 `auth.users`에 1:1 부속 테이블 + 트리거 추가, 기존 데이터·코드 영향 0).

---

## ③ 데이터 접근 계층 — service layer + throw

### 원칙

- **service layer(B 방식)**: 모든 DB/AI 접근을 도메인별 파일의 함수로 감싸고, 컴포넌트는 그 함수만 부른다. (OOP가 아니라 **모듈화** — Python의 `db.py`/`api.py`를 `import`하는 것과 동일 개념.)
  - 이유: 쿼리를 한 곳에서 관리·교체·테스트. 컴포넌트는 백엔드(Supabase·테이블명·Edge Function)에 무지 → 나중에 백엔드를 바꿔도 화면 무사.
- **함수는 `user_id`를 인자로 안 받음**: RLS가 `auth.uid()`로 자동 격리. INSERT 시 user_id는 레이어 안에서 `getUser()`로 채움.
- **반환 컨벤션 = throw**: Supabase는 실패를 조용히 `{ data, error }`로 준다. 레이어에서 **에러면 throw**(= Python `raise`)로 바꿔, 컴포넌트는 `try/catch`(= `try/except`) 한 패턴으로만 처리. (다음 단계 TanStack Query가 이 throw를 자동으로 잡아줌.)

### 함수 맵 (MVP)

```
services/
├── ai.js
│   └── askAI({ bookInfo, prev, selected, next, userRequest, history })
│         → supabase.functions.invoke('ask-ai', ...) → v3 JSON 반환
│           (Edge Function이 시스템 프롬프트·키·쿼터·responseSchema 처리. 클라는 컨텍스트만 전송)
│
├── books.js
│   ├── upsertBookByHash({ title, author, bookHash })   → book_id (book_hash 충돌 시 기존 행 재사용)
│   ├── addToLibrary(bookId)                            → user_books INSERT
│   ├── getLibrary()                                    → user_books ⨝ books, 최근 연 순
│   ├── removeFromLibrary(bookId)                       → user_books DELETE (cards/sentences 보존)
│   └── updateProgress(bookId, { cfi, pct })            → user_books UPDATE
│
├── cards.js
│   ├── saveWordCard({ bookId, word, meaning, thinking, exampleSentence, chapter })
│   ├── saveGrammarCard({ bookId, pattern, explanation, interpretationGuide, exampleSentence, chapter })
│   ├── getCards({ bookId?, kind? })                    → 단어/문법 탭·책 필터, 최신순
│   ├── deleteCard(cardId)
│   └── [나중] updateCardSRS(cardId, {...})             // SRS UI 단계
│
├── sessions.js
│   ├── startSession({ bookId, startCfi, startChapter })  → 이전 미종료 세션 정리 후 INSERT
│   ├── touchSession(sessionId, { cfi, chapter })          → last_activity_at 갱신 (호출 시점은 프론트 미정)
│   └── endSession(sessionId, { endCfi, endChapter })      → ended_at 마감
│
└── [나중] sentences.js   // 데이터 모델만 존재, UI는 다음 단계
```

### 핵심 계약

- **`askAI`는 응답을 *반환*만**, 저장은 별개다. 사용자가 `+`를 눌러야 `saveWordCard`가 저장. (AI 자동저장 아님 — plan_v3 D와 일치.)
- **`exampleSentence`(=`[Selected]` 원문)는 AI 응답이 아니라 클라가 들고 있다가 저장 시 첨부.** 시스템 프롬프트 v3가 "example_sentence는 응답에 안 넣는다"고 한 것과 정합.
- **`upsertBookByHash`**: DB문서의 UPSERT 패턴(`onConflict: 'book_hash'`)을 감쌈. epub 파일은 IndexedDB, **메타데이터만** 여기로.
- **`getLibrary`**: 관계 select(`select('*, books(*)')`)로 책 제목·작가까지 한 번에.
- **세션 3종**: DB문서 결정 6(A+C+last_activity_at)의 클라 측 구현. `startSession`이 "이전 미종료 세션 자동 마감"을 안에서 처리.

### 파일 구조

도메인별 분리(`ai/books/cards/sessions`) — 파일 수는 늘지만 코드 파악이 빠름. plan_v3가 적은 단일 파일 대신 `services/` 디렉토리로 분리. (supabase 클라이언트 인스턴스 자체는 `lib/supabase.js`에 두고 각 service가 import — 폴더는 frontend_arch ③에서 `lib/`로 확정, 구 `utils/` 표기 갱신.)

### 왜 JavaScript인가

- 프론트(React)가 JS → service layer는 프론트 코드의 일부라 무조건 JS.
- Edge Function은 **Deno 런타임 = JS/TS만** 실행 (Python 직접 불가).
- Python 백엔드는 별도 서버(FastAPI) + 호스팅 필요 → 서버리스 철학과 충돌, 우리 규모엔 과함.
- 결과: 한 언어로 프론트+백 통일 = 전환 비용 0. (`def→function`, `raise→throw`, async/await 거의 동일.)

---

## ④ Storage — curated_books Public 버킷

epub 출처가 두 갈래, 사는 곳이 다름:

| 출처 | 사는 곳 | 이유 |
| --- | --- | --- |
| **curated_free** (운영자 시드 책 50권) | **Supabase Storage** (`curated_books` 버킷) | 합법 호스팅, 전 사용자 공유 |
| **user_upload** (사용자 업로드) | **IndexedDB**(브라우저 로컬) | 저작권 책임 회피, Storage 부담 0 |

→ Storage가 다루는 건 사실상 **curated 책뿐**. user 업로드 epub은 클라우드에 안 올라가고(메타데이터만 books로), 파일은 그 단말기 IndexedDB에만.

### 버킷 정책

- **Public 버킷**: 파일마다 고정 URL, URL만 알면 다운로드. 저작권 free라 법적 문제 0, 단순·CDN 캐싱.
- 파일 경로: `curated_books/{book_id}.epub` (DB문서 seed.js와 일치)
- **Storage RLS**: SELECT 모두 허용 / 쓰기 정책 없음 → 아무도 못 함. 운영자만 **service_role**(seed.js)로 업로드. (books 테이블 정책과 동일 철학.)
- user 업로드는 Storage를 안 쓰므로 RLS 줄 것 없음(IndexedDB는 로컬이라 RLS 개념 없음).

### 클라가 epub 가져오는 흐름

```
책 열기(bookId, source)
  ├─ source === 'curated_free'
  │     → public URL: `${SUPABASE_URL}/storage/v1/object/public/curated_books/${bookId}.epub`
  │     → epub.js에 URL 전달 (필요시 받아 IndexedDB 캐시 → 다음부턴 오프라인)
  └─ source === 'user_upload'
        → IndexedDB에서 bookId 조회
        → 있으면 epub.js에 전달
        → 없으면(다른 단말기) → "이 단말기엔 파일이 없어요. epub을 다시 올려주세요" 안내
```

마지막 줄이 plan_v3 J의 "단말기마다 epub 한 번씩 올림" — book_hash로 단어장·진행은 자동 연결되나 *파일*은 로컬에만 있어 새 단말기엔 재업로드 필요(의도된 저작권 회피 설계).

> epub 로딩 세부 구현(`lib/indexeddb.js`, EpubReader 배선)은 **프론트 영역**. 백엔드 문서는 버킷 정책 + 가져오기 흐름 계약까지.

---

## ⑤ 에러 / 재시도 / 레이트

### 실패 지점 지도

```
화면 → askAI → [Edge Function: JWT검증 → 쿼터체크 → Gemini호출 → JSON검증] → 화면
        │            ①인증실패        ②쿼터초과    ③Gemini실패  ④형식오류
        └─ saveCard 등 DB 호출 → ⑤Supabase실패
```

### Edge Function 에러 계약 (핵심 산출물)

| 상황 | 상태코드 | Edge Function 동작 | 화면 메시지(예) |
| --- | --- | --- | --- |
| ① 토큰 없음/위조 | **401** | `getUser()` null → 거부 | "다시 로그인해줘" (보통 자동 복구) |
| ② 일일 쿼터 초과 | **429** | count ≥ 한도 → Gemini 안 부르고 거부 | "오늘 AI 사용량을 다 썼어. 내일 다시!" |
| ③ Gemini 실패(타임아웃/5xx/429) | **502** | 1회 재시도 후도 실패 → 거부 | "AI 응답을 못 받았어. 다시 시도해줘" + 재시도 버튼 |
| ④ JSON 형식 오류 | **502** | **재시도 안 함** → 즉시 거부 | ③과 동일 |
| 정상 | 200 | v3 JSON 반환 | 응답 렌더 |

→ 에러를 **"코드 + 짧은 메시지"로 정형화**하는 게 ⑤의 결과물. 프론트가 상태별 UI(plan_v3 C-11)를 짤 때 케이스를 미리 앎.

### 재시도 정책

- **③ Gemini 일시 실패(5xx/타임아웃/429)**: Edge Function 안에서 **1회만** 재시도(0.5~1초 뒤), 그래도 실패면 502.
- **타임아웃 상한**: Gemini 호출에 ~20초 상한 → 무한 대기 방지.
- **④ JSON 형식 오류**: **재시도 안 함** (responseSchema 강제라 거의 0, 나면 재시도해도 잘 안 고쳐짐 → 바로 502, 사용자가 다시 누름).
- **①인증/②쿼터**: 재시도 무의미 → 즉시 거부.
- **⑤ Supabase DB 실패**: MVP는 throw → 화면 토스트 "저장 실패, 다시 시도". 자동 재시도는 다음 단계 TanStack Query가 처리.

### 쿼터 배선 — 일일 카운터 (한도 100)

목적은 **폭주 차단**(비용 절감 아님). per-user 하루 N회.

```sql
-- ai_usage: user당 하루 AI 호출 수
CREATE TABLE public.ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- 사용자 직접 접근 정책 없음 → Edge Function이 service_role로만 읽고 씀
```

**Edge Function 흐름 (체크와 증가는 시점이 다름)**:

```
getUser() → user.id
1) 쿼터 체크 (호출 前) : (user.id, current_date)의 count >= 100?  →  예면 429 (Gemini 안 부름)
2) Gemini 호출         : 실패하면 502 (count 안 건드림 ← 실패는 안 셈)
3) 성공 後             : count += 1 (upsert)   ← 성공한 호출만 카운트
```

- **체크는 호출 전**(한도 넘으면 비싼 호출 자체를 안 함), **증가는 성공 후**(실패는 공짜, 공정).
- **follow-up 멀티턴은 턴마다 1회** 카운트(각 턴이 별도 Gemini 호출). → 한 문장당 ≈ 3~4회. 하루 100이면 25~30문장을 깊게 파도 안 닿음. 정상 사용자는 못 닿고 봇 폭주만 걸림.
- **한도 값은 env로** → 운영하며 조정.
- **RLS**: 사용자 직접 접근 정책 없음 → service_role 전용. (나중에 "남은 횟수" 표시하려면 SELECT 정책만 열기.)
- **정확도**: 동시 요청 시 카운트 1~2 어긋남 허용(폭주 차단엔 무해). 엄밀 atomic(Postgres RPC)은 소규모엔 오버킬 — 필요 시 교체.

### JSON 파싱·렌더 경계

- **백엔드 책임 = "구조 보장"까지**: Edge Function의 `generationConfig.responseSchema`(키·타입·enum)가 v3 JSON 모양을 강제. 스키마 정의가 백엔드에 사는 게 B의 또 다른 이득(중앙 한 곳).
- **프론트 책임 = "파싱 + 렌더"**: `JSON.parse` 후 `vocab.map(...)` 등으로 화면. 이미 plan_v3 영향 파일 `AIResponse.jsx`로 분류됨.
- 비유: 백엔드는 규격 부품(JSON) 송출, 프론트는 조립(화면). 규격서(스키마)는 공유 계약.

---

## 보안 체크리스트 (출시 직전 1회 점검)

별도 보안 문서는 과함 — 이 섹션 + DB문서 RLS 체크리스트로 충분. 보안의 본체는 ②인증·⑤레이트를 제대로 짜면 자동으로 박힘.

| # | 보안 표면 | 위험 | 대응 | 상태 |
| --- | --- | --- | --- | --- |
| 1 | 운영자 Gemini 키 | 노출 시 결제 폭탄 | Edge Function **Secret(env)에만**, 클라/git 금지 | ⑤ |
| 2 | service_role 키 | RLS 전체 무력화 | seed/서버에만, `.gitignore` | DB문서 |
| 3 | 누가 함수를 부르나 | 아무나 운영자 키로 Gemini | **Edge Function JWT 검증**(`getUser()`) | ② |
| 4 | 한 명이 폭주 | 봇 수만 회 호출 | per-user **일일 쿼터 100** | ⑤ |
| 5 | CORS | 아무 사이트나 함수 호출 | 허용 origin 제한 | 구현 시 |
| 6 | 사용자 간 데이터 격리 | A가 B 데이터 조회 | RLS `user_id = auth.uid()` | DB문서 완비 |
| 7 | 프롬프트 인젝션 | `[User Request]`로 프롬프트 무력화 | 출력이 학습 설명이라 피해 경미 — 모니터링 | 메모 |

**출시 전 점검 절차** (plan_v3 검증 방법에 합류):

- [ ] Gemini 키·service_role 키가 클라 번들/git에 없는지 (grep)
- [ ] Edge Function이 토큰 없는 호출을 401로 막는지
- [ ] 쿼터 100 초과 시 429 반환하는지
- [ ] CORS 허용 origin이 배포 도메인으로 제한됐는지
- [ ] DB문서의 RLS 테스트 체크리스트 (사용자 A가 B 데이터 못 보는지)

---

## DB 스키마 영향 (→ db_schema **v2.1**)

| 변경 | 내용 |
| --- | --- |
| **추가** | `ai_usage` 테이블 (위 ⑤ SQL) — 쿼터(나) 배선용. RLS enable + 사용자 정책 없음(service_role 전용) |
| **제외 명시** | `profiles` 테이블·인구통계(나이/성별) → **MVP 제외**, 필요 시 나중 추가(영향 0) |

> db_schema_v2.md에 `ai_usage` 섹션 반영 완료 시 버전 표기를 v2.1로 갱신.

---

## 영향 받는 파일 / 신규 파일 (구현 시)

**신규**:

- `supabase/functions/ask-ai/index.ts` — **Edge Function**: JWT 검증 → 쿼터 체크 → Gemini 호출(키·시스템프롬프트·responseSchema·1회 재시도) → 카운트 증가 → v3 JSON 반환
- `lib/supabase.js` — supabase 클라이언트(익명 자동 로그인, persist/autoRefresh)
- `services/ai.js` · `services/books.js` · `services/cards.js` · `services/sessions.js` — 데이터 접근 계층
- `lib/indexeddb.js` — epub 로컬 어댑터 (프론트와 공유)
- `lib/bookHash.js` — SHA-256 해시
- **DB 마이그레이션 SQL** — db_schema v2.1 + `ai_usage` 적용

**기존 변경**(plan_v3 영향 파일과 연동):

> **(plan_v3 §L 갱신, 2026-06-15)**: v2는 **fresh scaffold**라 아래는 in-place 수정이 아니라 `sentencemate-reader-v1/`에서 **로직만 참고해 새 구조(`services/`)로 작성**한다.

- `useGeminiAPI.js` — 직접 Gemini 호출 제거 → `services/ai.askAI()` 경유 (Edge Function). multi-turn `contents` 누적은 askAI 인자로
- `FileUploader.jsx` — `upsertBookByHash` + IndexedDB 저장
- `storage.js` — 대부분 폐기 → service layer로

---

## 미정 / 다음 단계

- [ ] **C(본인 키 옵션)** — MVP 후 필요 시 (`if(userKey)` 분기 + 설정 UI)
- [ ] **Google OAuth** — 이메일 가입 안정화 후 linkIdentity provider 추가
- [ ] **가입 유도 UX·안내 페이지** — 캐시 삭제 시 데이터 유실 경고 (프론트)
- [ ] **profiles 테이블 + 인구통계** — 분석 필요 시
- [ ] **touchSession 호출 시점** — 어떤 활동(페이지 넘김/카드 추가/스크롤)을 트리거로 (프론트, plan_v3 미정 항목)
- [ ] **쿼터 atomic 정확도** — 동시성 문제 실측되면 Postgres RPC로 교체
- [ ] **쿼터 한도 튜닝** — 실사용 후 100 조정
- [ ] **"남은 횟수" 표시** — 필요 시 ai_usage SELECT 정책 추가

---

## 다음 작업

plan_v3 "남은 설계 작업"의 **A 백엔드 완료** → 다음은 **B. 프론트엔드 아키텍처**(상태관리/TanStack Query, 라우팅, 폴더 구조). 백엔드 계약(이 문서)이 정해졌으니 프론트 데이터 흐름을 그릴 수 있다.
