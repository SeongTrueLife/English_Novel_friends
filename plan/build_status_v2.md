# SentenceMate Reader v2 — 구현 현황 (1차 완료)

작성: 2026-06-19
상태: **1차 코딩 완료(M0~M8) + Vercel 배포 + 보안 점검 통과.** 이후 작업은 아래 [백로그](#백로그-다음-세션들).
성격: **살아있는 현황 문서**(백로그가 진행되면 갱신). 설계 "왜"는 plan 문서가 정본 — 여기선 *무엇이 됐고/어디 배포됐고/뭐가 남았나*만. 항상 로드되는 터스 버전은 [`../sentencemate-reader/CLAUDE.md`](../sentencemate-reader/CLAUDE.md).

> v1(구버전)은 `sentencemate-reader-v1/`에 동결(읽기전용 참고). v2는 fresh scaffold로 새로 작성.

---

## 한 줄 요약

epub 원서를 읽다 문장을 선택하면 AI가 **추론-우선 4축 JSON 풀이**(단어·문법·문장생각·자연해석)를 주고, 단어/문법 **카드로 저장**해 **플래시카드·통계**로 복습하는 리더. 익명 시작 → 이메일 연동으로 기기 간 동기화. PWA.

---

## 완료 — M0~M8 (실제 동작)

| M | 내용 | 동작 |
| --- | --- | --- |
| **M0** | 토대 | react-router(라우트 6+guide) + AppShell(탭바, 리더서 숨김) + `lib/supabase`(익명 자동 부팅, StrictMode 가드) + TanStack QueryClient + Zustand(`useSession`) |
| **M1** | DB 마이그레이션 | `supabase/migrations/0001_init.sql` 적용 — 6테이블(books/user_books/cards/sentences/reading_sessions/ai_usage) + 인덱스 6 + 트리거 3 + RLS 전체. 검증 쿼리 `0001_verify.sql` |
| **M2** | 라이브러리 + 책 추가 | epub 업로드 → SHA-256 해시 → 메타 파싱(epubjs) → IndexedDB 파일 저장 + `upsertBookByHash`(SELECT-then-INSERT) → 서재 표지(타이포 폴백) 등장. `services/books.js`, `lib/{bookHash,indexeddb}.js`, `features/library/*` |
| **M3** | 리더 + 문장 선택 | IndexedDB epub → epubjs paginated 렌더 + 쪽넘김(탭존/키보드) + 나가기. 문장 선택 → 앞뒤 2문장 추출 → "Ask AI" 버튼 → payload 조립. `features/reader/{useReader,useBook,useTextSelection,sentenceExtractor,SelectionAskAI}` |
| **M4** | AI 연동 + 4축 렌더 | **Edge Function `ask-ai`**(JWT검증→쿼터→마커조립→Gemini responseSchema·1회재시도→카운트++) + `services/ai.askAI` + `AIResponse` 4축 구조화 렌더(thinking 펼침/자연해석 접힘) + 마크다운(XSS 안전) + 로딩/에러(401/429/502). 모델 `gemini-3-flash-preview` |
| **M5** | 카드 저장 + 단어장 | `⊕` 낙관적 저장(mutation 상태 파생, 중복차단) + `services/cards.js`(word/grammar kind별 CHECK 통과) + 단어장(단어/문법 탭·책별 그룹·예문 펼침·삭제). **= 핵심 루프 완주** |
| **M6** | follow-up + 진척/세션 | follow-up 멀티턴(Option A: v3 JSON 재사용, history echo, 휘발성) + CFI 진척 저장·**이어읽기 복원** + `reading_sessions`(start/touch/end, A+C 미종료 정리). `useConversation`, `useReadingSession`, `services/sessions.js` |
| **M7** | 플래시카드 + 통계 | 플래시카드(범위 시트: 전체/최근/안외운것/챕터별 + 섞기, 뒤집기·이전/다음) + 통계(카드 기반 KPI·책별 진척·책별 상세). + **챕터를 카드 저장에 배선**(챕터별 활성화) + **단어장 선택 모드**(선택 학습/삭제) |
| **M8** | 이메일 연동 + 가이드 + PWA | 익명→이메일 연동(`updateUser`, Confirm ON, 계정 시트 + 단어장 소프트 힌트) + 설명 페이지(`/guide`, 첫 실행 1회) + PWA(vite-plugin-pwa: 설치 + 오프라인 앱 셸) |

---

## 아키텍처 요약

- **스택**: React 19 + Vite + epubjs / react-router-dom / TanStack Query(서버 상태) + Zustand(클라 전역 소수) / Supabase(익명 인증·Postgres·RLS·Edge Function) / IndexedDB(`idb`, 사용자 epub 로컬) / vite-plugin-pwa.
- **폴더**: 하이브리드 — 공통=종류별(`services/`·`stores/`·`lib/`·`components/ui/`), 화면=`features/`. 상세: [frontend_arch ③](frontend/frontend_arch_v1_26_06_14.md).
- **AI**: 브라우저 → Edge Function `ask-ai`(서버에 키·시스템프롬프트·responseSchema) → Gemini. 클라는 컨텍스트만 전송(B 전략).
- **불변 규칙**(CLAUDE.md): service 함수 throw / 컴포넌트는 Supabase 직접 접근 금지 / 서버데이터 Zustand 금지 / 비밀키 `VITE_` 금지 / example_sentence는 클라가 첨부.

---

## 배포 현황

| 항목 | 값 |
| --- | --- |
| **프론트(Vercel)** | https://english-novel-friends.vercel.app — Root Directory = `sentencemate-reader`, env: `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`(publishable) |
| **Supabase** | 프로젝트 ref `rcovmubcykojirnqgzqa`. 익명 인증 ON, Confirm email ON, Redirect URLs(localhost:5173/* + 프로덕션/**) |
| **Edge Function** | `ask-ai` 배포됨. secret: `GEMINI_API_KEY`, `AI_DAILY_QUOTA`(100). SUPABASE_* 는 런타임 자동주입 |
| **Storage** | `curated_books` 버킷 **미생성**(큐레이션 단계에서) |
| **DB** | 마이그레이션 적용 완료(6테이블·RLS·트리거·인덱스) |
| **보안 점검** | ✅ 통과 — 클라 번들/git 비밀키 0건, 라이브 401/CORS echo·거부, **RLS 2계정 격리 실증**(A가 B 카드 못 봄·위장 INSERT 403) |

**재배포**: 프론트=git push(Vercel 자동) / Edge Function=`npx supabase functions deploy ask-ai`(secret 유지됨).

---

## 구현 중 확정·변경된 핵심 결정

설계 후 구현하며 잡힌 것들(plan 정본에도 반영됨):

- **books `upsertBookByHash` = SELECT-then-INSERT**(+UNIQUE 경쟁 fallback) — books엔 RLS UPDATE 정책이 없어 upsert(DO UPDATE)가 충돌 시 막힘. book_hash 트릭이 작동할 바로 그 순간을 보호.
- **follow-up = Option A(v3 JSON 재사용)** — 시스템 프롬프트의 `[User Request]` 설계와 정합. 트레이드오프(같은 단어 재설명) 수용, 피드백 후 재고. (plan_v3 §C)
- **익명→이메일 = `updateUser({email,password})` 단일 호출**(linkIdentity는 OAuth 전용), Confirm email ON(오타 lockout 방지). (backend_design ② 갱신)
- **가입유도 자동팝업 제외** → 비강요(가이드 페이지 + 단어장 소프트 힌트 + 계정 아이콘). (2026-06-19)
- **진행률(pct) = spine 위치 기반 근사** — epubjs `locations.generate`가 깨진 섹션서 터지고 작은 책서 0 반환 → 제거하고 동기 spine 계산으로.
- **세션 부활버그 회피** — visibility hidden=touch, pagehide/언마운트=end, startSession A+C 정리가 안전망. (db_schema 결정6 갱신)
- **모델 id** `gemini-3-flash` → **`gemini-3-flash-preview`**(404 확인). (plan_v3 E)

---

## 백로그 (다음 세션들)

우선순위·의존순서:

1. **SE epub 렌더 수정** — SE 타이틀페이지 SVG 과측정 빈 페이지. ⚠️ **선행: SE 에디션 라이선스 조사**(상업/구독 사용 가능 여부, 표지·로고 별도 여부) — 사용자 조사 중.
2. **큐레이션 무료책 인프라** — Storage `curated_books` 버킷 생성 + 시드 스크립트(`seeds/seed.js`, service_role) + epub 업로드. (1번 이후, SE 책 쓸 경우)
3. **큐레이션 카탈로그 화면** — 사용자가 무료책을 둘러보고 서재에 추가하는 UI(현재 없음). 리더의 `curated_free` 읽기 경로는 이미 배선됨.
4. **리더 챕터 점프(TOC 시트)** — `book.navigation.toc` → 챕터 탭하면 `rendition.display(href)` 점프. *쉬움·큰 효과*(앞쪽 다시보기 고통 해소). frontend_plan §6.2 미구현분.
5. **리더 진행 스크러버** — 하단 드래그로 위치 이동. locations 없이 **spine(섹션) 기반**으로. (4 다음, 중간 난이도)
6. **추천 온보딩 퀴즈** — 설문 → 난이도·취향 맞춤 책 추천. *선행: books에 difficulty/genre(/embedding) 컬럼 보강.* (카탈로그·데이터 쌓인 뒤)
7. **단어장 책→챕터→단어 접기** — 카드 많아질 때 계층 접기(문법도). 필수는 아님.
8. **(기존 다음단계)** SRS 간격계산(SM-2)·복습 알림 / 세션 기반 통계(읽은시간·연속일) / 문장 컬렉션 UI(`sentences` 테이블 준비됨) / Google OAuth / 다크모드 토큰 적용 / 카드 삭제 confirm·undo.

---

## 알려진 이슈

- **SE(standardebooks) epub**: 타이틀페이지 SVG를 epubjs가 과측정 → 빈 페이지. 리더 코어·다른 epub은 정상. (백로그 1)
- **진행률(pct)**: spine 위치 기반 근사값(섹션 단위). 정확 % 필요 시 epubjs locations 견고화 별도 태스크.
- **`useReadingSession` 세션 ref**: 현재 UI는 책 전환 시 리더가 언마운트돼 무해하나, 향후 reader→reader 직접 내비 추가 시 effect 시작에서 ref 리셋 필요(메모).

---

## 작업 워크플로우 (기록)

- **감독 세션 ↔ 코딩 세션 분리**: 한 세션(감독)이 계획·메타프롬프팅·코드 검수, 별도 세션이 실제 구현. 마일스톤(수직 슬라이스) 단위로 코딩 세션을 나눔.
- **수직 슬라이스**: 한 기능을 DB→service→화면까지 관통해 매 단계 "돌아가는 상태" 유지(수평 층쌓기 회피).
- **플랜 모드 우선**: 미묘한 설계(인증·멀티턴·세션)는 코딩 전 플랜 모드 결과를 감독이 검수 후 진행.
- **커밋**: 마일스톤/조각 단위. 슬라이스 끝에서 실행 검증.

---

## 정본 문서 포인터

- [plan_v3](plan_v3_26_06_09.md) — 계획·결정 정본
- [backend_design_v1](backend_design_v1_26_06_09.md) — 키·인증·service layer·에러·CORS
- [frontend/frontend_arch_v1](frontend/frontend_arch_v1_26_06_14.md) — 라우팅·상태·폴더·시퀀싱 M0~M8
- [frontend/frontend_plan_v1](frontend/frontend_plan_v1.md) — 화면 UI/UX §6.x
- [../db/db_schema_v2.md](../db/db_schema_v2.md) — 테이블·인덱스·RLS·트리거
- [../SystemPrompt/system_prompt_v3_final_en.md](../SystemPrompt/system_prompt_v3_final_en.md) — AI 응답 JSON 스키마
