# SentenceMate Reader — 프론트엔드 기술 아키텍처 (frontend arch)

문서 버전: **v1** / 작성: 2026-06-14
상태: **현재 정본 (current)** — 프론트엔드 기술 뼈대(라우팅·상태관리·폴더·시퀀싱·환경)
상위 문서: [../plan_v3_26_06_09.md](../plan_v3_26_06_09.md) "남은 설계 작업 > B. 프론트 아키텍처(6~8) + D. 구현 시퀀싱(13~15)"의 산출물

연계 정본:

- [../plan_v3_26_06_09.md](../plan_v3_26_06_09.md) — 계획 정본(결정·맥락)
- [frontend_plan_v1.md](frontend_plan_v1.md) — **프론트 UI/UX 정본**(화면·반응형·컴포넌트 맵). 시각 시안: `design_mockups.html`
- [../backend_design_v1_26_06_09.md](../backend_design_v1_26_06_09.md) — 백엔드 계약(키·인증·service layer·에러). **이 문서는 그 계약을 전제**로 함
- [../../db/db_schema_v2.md](../../db/db_schema_v2.md) — DB 스키마(쿼리·캐시 키 설계 근거)
- [../../SystemPrompt/system_prompt_v3_final_en.md](../../SystemPrompt/system_prompt_v3_final_en.md) — AI 응답 JSON 스키마
- [frontend_learning_notes.md](frontend_learning_notes.md) — **프론트엔드 개념 일반론**(라우팅·상태·캐시·폴더·시퀀싱 강의). 복습용, 비정본

> **이 문서의 역할**: frontend_plan이 *"어떤 화면을 그리나"*(UI/UX)를 다뤘고, 이 문서는 그 화면을 떠받칠 *"기술 뼈대를 어떻게 짜나"*(라우팅·상태·폴더·구현 순서)를 못 박는다. 화면 디테일은 frontend_plan, 데이터 주고받기 계약은 backend_design 참조(단일 출처 원칙).

---

## 0. 한눈에 — 확정된 갈림길

| 항목 | 결정 | 한 줄 이유 |
| --- | --- | --- |
| **① 라우팅** | **react-router-dom 도입** (URL 기반, 클라이언트 사이드) | 멀티화면 PWA → 뒤로가기·새로고침 위치보존·딥링크가 공짜. 태블릿 1차라 시스템 뒤로가기 필수 |
| **라우트 vs 오버레이** | 목적지 = 라우트 / 곁일(sub-task) = 오버레이 상태 | AI시트·책추가·계정연결은 화면이 아니라 *맥락 위 상태* → 라우트로 만들지 않음 |
| **② 상태관리** | **C 조합: TanStack Query(서버) + Zustand(클라, 작게)** | 이 앱은 서버 상태가 압도적 → 전용 도구가 최대 ROI. throw 컨벤션·낙관적 업데이트 UX와 정합 |
| **③ 폴더 구조** | **하이브리드** (공통=종류별 / 화면=기능별 `features/`) | 솔로·7화면. "단어장만 고치기 = `features/vocab/`" 직관 + 공통은 깔끔히 모음 |
| **④ 시퀀싱** | **수직 슬라이스**, M0~M8 (핵심루프 = M5) | 층 쌓기(수평) 함정 회피. 첫날부터 돌아가는 상태 유지 |
| **⑤ 환경/시크릿** | `VITE_` 접두사만 클라 노출 / 비밀키는 Edge Function secret | `VITE_`=무조건 번들에 노출 → 비밀엔 절대 안 붙임 |

---

## ① 라우팅 + 화면 지도

### 결정: react-router-dom (클라이언트 사이드 라우팅)

화면이 7~8개로 늘고 PWA endgame이라 URL 기반 라우팅 도입. URL이 바뀌어도 **페이지 리로드는 없음**(SPA, react-router가 브라우저 안에서 컴포넌트만 교체).

**도입 근거**:

- 태블릿/안드로이드 **시스템 뒤로가기 버튼** — URL 없으면 깊은 화면에서 앱이 통째로 닫힘. URL 있으면 자연스러운 화면 후퇴.
- **새로고침/PWA 재실행 시 위치 보존** — state 방식은 항상 첫 화면으로 초기화.
- **딥링크** — "이 책 통계 보기" → `/stats/:bookId` 바로 점프.

대안 비교(요약): 현행 state 라우팅(화면 2개 넘으면 붕괴) / 자체 mini 라우터(바퀴 재발명, 함정 多) → 둘 다 탈락.

### 핵심 구분: 라우트 vs 오버레이

> **그 자체가 목적지(destination)면 라우트, 지금 맥락 위 곁일(sub-task)이면 오버레이.**

오버레이를 라우트로 만들면 뒤로가기 의미가 모호해짐(리더에서 단어 물었는데 주소 바뀌면 뒤로가기가 시트만 닫을지 리더를 나갈지 애매). frontend_plan §4 "회전 시 상태 보존"(바텀시트↔사이드패널 = 레이아웃만 전환, 열림·내용 유지)과도 정합 — AI 시트는 화면이 아니라 *리더의 한 상태*.

### 화면 지도 (라우트 표)

| 라우트 | 화면 | 셸(AppShell) | 비고 |
| --- | --- | --- | --- |
| `/` | → `/library` redirect | — | |
| `/library` | 서재 (첫 화면) | 표시 | frontend_plan §6.1 |
| `/read/:bookId` | 리더 | **숨김**(몰입) | §6.2. AI시트는 오버레이 |
| `/vocab` | 단어장 목록 | 표시 | §6.3. 단어/문법 탭 = `?tab=word\|grammar` 쿼리파라미터 |
| `/vocab/study` | 플래시카드 학습 | 표시 | §6.4. 범위시트 → 카드 |
| `/stats` | 통계 대시보드 | 표시 | §6.6 |
| `/stats/:bookId` | 책별 상세 | 표시 | §6.7 |

**오버레이(라우트 아님, 어느 화면에서나 상태로 띄움)**: AI 응답 시트(리더) · 책 추가 모달 · 계정 연결 시트 · 설정.

- 탭 선택은 쿼리파라미터(`?tab=`)로 — URL에 담아 새로고침·딥링크에도 탭 유지. 단, 가벼운 탭이면 컴포넌트 로컬 state도 허용(구현 시 판단).
- `AppShell`이 현재 라우트를 보고 셸(세로 탭바 ↔ 가로 레일)을 표시/숨김. 리더(`/read/*`)에서만 숨김.

---

## ② 상태관리 + 서버 캐시

### 대전제: 상태는 두 종류 — 서버 상태 / 클라이언트 상태

| 종류 | 진짜 주인 | 예시 | 도구 |
| --- | --- | --- | --- |
| **서버 상태**(서버 캐시) | Supabase(원격) | 카드 목록, 라이브러리, AI 응답, 읽기 진척, 통계 | **TanStack Query** |
| **클라이언트 상태**(UI) | 이 브라우저 | user 세션, 다크모드, 폰트크기, 읽기설정 | **Zustand**(전역 소수) / **useState**(컴포넌트 로컬) |

화면에 보이는 서버 데이터는 **원본의 복사본(캐시)** — 다른 기기 변경 시 낡아짐(stale), 네트워크라 로딩/에러가 따라옴. 이 골칫거리(캐싱·재요청·로딩/에러·중복제거·여러 화면 공유·저장 후 갱신)는 **서버 상태에만** 존재 → 전용 도구가 필요.

### 서버 상태 = TanStack Query

`useQuery`(읽기) / `useMutation`(쓰기) 두 훅이 위 골칫거리를 통째로 가져감. **실제 Supabase 호출은 여전히 service layer 함수**(`getCards` 등)가 하고, Query가 그걸 **감싸서** 캐싱·로딩/에러·재요청을 입힘.

```jsx
// 읽기 — queryKey로 캐시. 같은 키는 한 번 요청·여러 화면 공유
const { data: cards, isLoading, error } = useQuery({
  queryKey: ['cards', { bookId, kind }],
  queryFn: () => getCards({ bookId, kind }),   // ← service layer 그대로
})

// 쓰기 — 저장 후 목록 자동 갱신 + 낙관적 업데이트
const { mutate: save } = useMutation({
  mutationFn: saveWordCard,
  onMutate: async (newCard) => { /* 즉시 ⊕→✓ (낙관적) */ },
  onError: (e, v, ctx) => { /* ✓→⊕ 롤백 + 토스트 */ },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
})
```

**우리 설계와의 맞물림**:

- **throw 컨벤션 회수**: backend_design ③이 정한 "service 함수는 실패 시 throw"를 TanStack Query가 자동으로 잡아 `error`에 담음. 컴포넌트는 `error`만 보면 됨.
- **낙관적 업데이트**: frontend_plan §6.2 "`⊕` 즉시 `✓`, 실패 시에만 롤백"을 `onMutate`/`onError`로 구현(위 코드).

### queryKey / 무효화(invalidation) 컨벤션

| queryKey | 쓰는 화면 | 무효화 트리거 |
| --- | --- | --- |
| `['library']` | 서재 | 책 추가/제거, 진척 갱신 |
| `['cards', { bookId?, kind? }]` | 단어장·통계·책별상세 | 카드 저장/삭제 |
| `['book', bookId]` | 리더·책별상세 | 진척 갱신 |
| `['stats']` | 통계 대시보드 | 카드 저장/삭제 |

- **AI 응답(`askAI`)은 캐시 대상 아님** — 매번 새 호출이라 `useMutation`으로 다룸(읽기 캐시 X). follow-up 멀티턴도 mutation 누적.
- 무효화는 "성공 후 관련 키 invalidate" 표준 패턴(위 `onSettled`).

### 클라이언트 상태 = Zustand (작게)

전역 공유가 필요한 **소수**의 클라 상태만 Zustand store에 둠. provider 불필요, import해서 "필요한 칸만 구독".

```js
// stores/useSettings.js
import { create } from 'zustand'
export const useSettings = create((set) => ({
  theme: 'light', fontSize: 18,
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setFontSize: (n) => set({ fontSize: n }),
}))
```

**store는 둘만(예상)**: `useSession`(로그인 user) · `useSettings`(테마·폰트·읽기설정).

> **과설계 경계선(중요)**: ① 서버 데이터(카드 목록 등)를 Zustand에 넣지 말 것 — 그건 Query 일. Zustand는 "전역 UI 설정 서랍"으로만. ② 컴포넌트 한 곳만 아는 상태(탭 선택, 시트 열림)는 그냥 `useState` — store에 올리지 말 것. 이 절제가 C 조합을 가볍게 유지하는 핵심.

---

## ③ 폴더 / 모듈 구조 — 하이브리드

철학: **공통(여러 화면 공유) = 종류별 / 화면 전용 = 기능별(`features/`)**. "단어장 고칠 일 = `features/vocab/` 한 폴더"가 성립하도록.

```
src/
├─ main.jsx                  앱 진입 + Provider(QueryClientProvider) + Router
├─ App.jsx                   라우트 정의 (화면 지도)
│
├─ app/                      앱 전역 인프라
│   ├─ router.jsx            라우트 ↔ 화면 매핑
│   └─ AppShell.jsx          탭바↔레일 셸 (리더 라우트에서 숨김)
│
├─ features/                 ★ 화면별로 묶기 (기능별)
│   ├─ library/   BookLibrary, ContinueReading, BookCover(타이포폴백), AddBookTile, AddBookSheet(FileUploader+BookMetaForm), useLibrary
│   ├─ reader/    EpubReader, ReaderControls(TopBar·ProgressScrubber·TocSheet·SettingsSheet), AIResponse, VocabItem, ThinkingCard, GrammarItem, NaturalTranslation, FollowUp, useReader
│   ├─ vocab/     VocabList, FlashcardStudy, StudyScopeSheet, useCards
│   ├─ stats/     StatsDashboard, BookStats, KpiCard, useStats
│   └─ account/   LinkAccountSheet   (AddBookSheet은 라이브러리에서 띄우므로 library/로 이동 — 2026 구현 시 정정)
│
├─ services/                 ★ 데이터 접근 계층 (backend_design 확정 — 종류별)
│   └─ ai.js  books.js  cards.js  sessions.js   (+ 나중: sentences.js)
│
├─ stores/                   ★ Zustand 서랍 (종류별, 소수)
│   └─ useSession.js  useSettings.js
│
├─ hooks/                    여러 기능 공유 훅만 (예: useOrientation — 세로/가로 감지)
├─ lib/                      서드파티 인프라 래퍼
│   └─ supabase.js  indexeddb.js  bookHash.js  parseAIJson.js
├─ components/ui/            진짜 범용 조각 (Button, Sheet, Skeleton, EmptyState, ErrorState, Toast)
└─ styles/                   디자인 토큰(§3 frontend_plan) + 전역 CSS
```

규칙 셋:

1. **화면 한 곳에서만 쓰는 컴포넌트·훅 → 그 `features/` 폴더 안**.
2. **여러 화면 공유만** 밖으로(`services/`·`stores/`·`hooks/`·`components/ui/`·`lib/`).
3. **`services/`는 backend_design에서 확정 — 그대로**. "컴포넌트는 Supabase를 모른다"의 방어선.

- TanStack Query 훅(`useQuery`)은 각 feature의 `useXxx.js`(예 `useLibrary`)에 감싸 둠 → 화면 컴포넌트는 "데이터 줘"만 부르고 캐싱/로딩은 훅이 처리.
- 이름: 서드파티 래퍼는 `lib/`(기존 `utils/`에서 변경 — throwaway 프로토타입이라 재설계 자유). 폴더 파일은 PascalCase 컴포넌트 / camelCase 훅·유틸.

---

## ④ 의존성 (도입 목록)

| 패키지 | 용도 | 갈림길 |
| --- | --- | --- |
| `react-router-dom` | 라우팅 | ① |
| `@tanstack/react-query` | 서버 상태 | ② |
| `zustand` | 클라 상태(전역 소수) | ② |
| `@supabase/supabase-js` | Supabase 클라이언트 | backend |
| `idb` | IndexedDB 래퍼(epub 로컬) | backend J |
| `vite-plugin-pwa` (M8) | PWA(설치·오프라인) | plan_v3 K |

기존: `react@19`, `react-dom@19`, `epubjs`, `vite@8` 유지.

---

## ⑤ 환경 / 시크릿

> **철칙: `VITE_` 접두사가 붙은 변수는 무조건 클라이언트 번들에 노출된다 → 비밀 키엔 절대 `VITE_`를 안 붙인다.**

| 변수 | 위치 | 클라 번들 | 비고 |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env`(커밋 X) | ✅ (공개 OK) | |
| `VITE_SUPABASE_ANON_KEY` | `.env` | ✅ (**설계상 공개**) | RLS가 보호 |
| `GEMINI_API_KEY` | **Edge Function secret** (`supabase secrets set`) | ❌ 절대 | 운영자 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function + seed 스크립트 env | ❌ 절대 | RLS 무력화 |
| `AI_DAILY_QUOTA` | Edge Function env | ❌ | 쿼터 한도(기본 100) |

- `.gitignore`: `.env*` (단 `.env.example`은 커밋해 키 목록 공유).
- backend_design 보안 체크리스트 1·2번(키 노출 금지)과 정합. 출시 전 grep으로 클라 번들/git에 비밀키 없는지 확인.

---

## ⑥ 구현 시퀀싱 — 수직 슬라이스, M0~M8

원칙: **층 쌓기(DB 다→service 다→화면 다 = 수평)는 함정.** 한 기능을 DB→service→화면까지 얇게 관통해 *돌아가는 상태*로 만들고 다음을 얹는다(수직 슬라이스). frontend_plan §9 "핵심 루프 먼저"와 정렬.

**핵심 루프**(= 앱이 살아있다고 말하는 최소 동작):
`책 연다 → 문장 선택 → Ask AI → 응답 렌더 → ⊕ 카드 저장 → 단어장 확인`

| M | 마일스톤 | 끝나면 동작 | 관련 |
| --- | --- | --- | --- |
| **M0** | **토대** | 라이브러리 설치 + 폴더 구조 + `App.jsx` 라우터 + `AppShell` 껍데기 + `lib/supabase.js`(익명 부팅) + QueryClientProvider. 빈 화면이지만 라우팅·인증이 산다 | ①②③ |
| **M1** | **DB 마이그레이션 + 인증 확인** | db_schema v2.1 SQL 적용 + RLS 테스트. 익명 user 부팅·토큰 발급 확인 | DB·backend |
| **M2** | **라이브러리 + 책 추가**(슬라이스1) | epub 업로드 → hash·파싱 → IndexedDB 저장 + `upsertBookByHash` → 서재 표지 등장 | §6.1·6.5 |
| **M3** | **리더 + 선택** | 책 탭 → epub.js paginated → 문장 선택 → "Ask AI" + 앞뒤 2문장 추출(AI 연결 전) | §6.2 |
| **M4** | **AI 연동 + 응답 렌더** | `askAI` → Edge Function → v3 JSON → 4축 렌더(thinking 펼침/자연해석 접힘) + 로딩 스켈레톤·에러(429/502) | §6.2·6.8 |
| **M5** | **카드 저장 + 단어장** 🎉 | `⊕` 낙관적 저장(`useMutation`) → `cards` 적재 → 단어장(단어/문법 탭·책필터). **핵심 루프 완성** | §6.2·6.3 |
| **M6** | **follow-up + 읽기 진척** | AI 멀티턴 누적, CFI 진행 저장, reading_sessions 시작/마감 | §6.2·세션 |
| **M7** | **플래시카드 + 통계(카드기반)** | 학습 모드(뒤집기·범위시트, SRS 간격계산 제외), 통계 대시보드(카드 수·진척) | §6.4·6.6 |
| **M8** | **가입 유도 + PWA + 출시 점검** | LinkAccountSheet(50개 마일스톤), vite-plugin-pwa, 보안 체크리스트 | §6.9·배포 |

설계 의도:

- **M0~M1 = 토대**(불가피한 수평). 화면은 비었어도 라우팅·상태·인증·DB가 살아야 위에 기능을 얹음.
- **M2부터 진짜 수직 슬라이스** — 각 M이 "돌아가는 기능 하나"를 통째로 더함.
- **M5 = 분수령**(핵심 루프 완성). 시간 모자라면 M5까지가 곧 MVP. M6~M8은 얹기.
- 이번 빌드 범위 = **M7까지**(frontend_plan §9의 6.1~6.8). **M8(가입유도 6.9 + PWA + 출시점검)은 출시 직전** — 가입유도는 linkIdentity 배선·PWA(iOS 7일 규칙 완화)·보안점검과 한 묶음이고 트리거가 '단어 50개'라 초기엔 안 떠서 M8에 둠.

---

## ⑦ 의도적 보류 (구현 중 결정 — frontend_plan §10)

미리 정하면 헛수고가 되는, 화면 만들며 손끝으로 정할 것. **빠뜨림이 아니라 의도적 연기**:

- Ask AI 옆 `+` 추가 프롬프트 토글 위치·키보드 대응 (M4)
- follow-up 칩 누적 모양 (M6)
- 자연 해석 펼침 + **"내가 먼저 적어보기" 입력** (M4~M5) — *추론-우선 정체성의 핵심*
- 중복 카드 정책 / `last_activity_at` 갱신 트리거 시점 (M5~M6)

> frontend_plan §10의 "라우팅/상태관리(TanStack Query)" 항목은 **이 문서에서 확정**되어 더 이상 보류 아님.

---

## 진행 상태 / 다음 작업

- ✅ 프론트 기술 뼈대 확정: 라우팅(①) · 상태관리(②) · 폴더(③) · 의존성(④) · 환경/시크릿(⑤) · 시퀀싱(⑥)
- ⏳ **다음**: **M1 — DB 마이그레이션 SQL 적용**(db_schema v2.1 → Supabase, RLS 테스트 체크리스트) → **M0 토대 코딩** → 핵심 루프(M2~M5).
  - (M0/M1은 서로 독립이라 순서 유연. Edge Function `ask-ai`는 M4 전까지 준비.)
- 설계 단계(plan_v3 "남은 설계 작업" A·B·C·D) **전부 완료** — 이제 코드 구현.
