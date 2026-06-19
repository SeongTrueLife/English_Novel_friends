# SentenceMate Reader — v2

추론-우선 영어 학습 리더. v1(`../sentencemate-reader-v1/`, 읽기전용 참고)을 재설계해 **새로 작성**하는 v2.

## 정본 문서 (상세는 항상 여기 참조 — 이 파일엔 복붙하지 않음)
- 계획·결정: `../plan/plan_v3_26_06_09.md`
- 백엔드 계약(키·인증·service layer·에러): `../plan/backend_design_v1_26_06_09.md`
- 프론트 기술 아키텍처(라우팅·상태·폴더·M0~M8): `../plan/frontend/frontend_arch_v1_26_06_14.md`
- 프론트 UI/UX(화면 §6.x): `../plan/frontend/frontend_plan_v1.md`
- DB 스키마: `../db/db_schema_v2.md`
- 시스템 프롬프트(영문, Edge Function용): `../SystemPrompt/system_prompt_v3_final_en.md`

## 확정된 갈림길 (바꾸려면 먼저 사용자에게 물어볼 것)
- 라우팅: **react-router-dom** (URL 기반 SPA)
- 상태: **TanStack Query**(서버) + **Zustand**(클라 전역 소수) + useState(컴포넌트 로컬)
- 폴더: **하이브리드** — 공통=종류별, 화면=`features/`
- AI 키: **Edge Function 프록시** (운영자 키는 서버에만, 일일 쿼터 100)
- 빌드 방식: **fresh scaffold** (in-place 아님). v1은 스니펫 참고만.

## 불변 규칙 (자주 어기는 것 — 반드시 지킬 것)
1. `services/*.js` 함수는 실패 시 **throw**. 컴포넌트는 try/catch 또는 TanStack Query `error`로 처리.
2. 컴포넌트는 Supabase를 **직접 모른다** — 모든 DB/AI 접근은 `services/` 경유.
3. 서버 데이터를 Zustand/useState에 복제 금지 → TanStack Query 캐시가 단일 출처.
4. 비밀키에 `VITE_` 금지 (`VITE_`는 클라 번들에 노출). Gemini·service_role 키는 Edge Function secret.
5. `example_sentence`(=`[Selected]` 원문)는 AI 응답이 아니라 클라가 들고 있다가 저장 시 첨부.
6. 화면 한 곳만 쓰는 컴포넌트·훅 → 그 `features/` 폴더 안. 여러 화면 공유만 밖으로.

## 폴더 구조 (frontend_arch ③)
```
src/
  app/            router.jsx, AppShell.jsx
  features/       library / reader / vocab / stats / account
  services/       ai.js, books.js, cards.js, sessions.js
  stores/         useSession.js, useSettings.js
  hooks/          여러 화면 공유 훅만
  lib/            supabase.js, indexeddb.js, bookHash.js, parseAIJson.js
  components/ui/  Button, Sheet, Skeleton, EmptyState, ErrorState, Toast
  styles/         디자인 토큰 + 전역 CSS
```

## 구현 순서 (수직 슬라이스 — frontend_arch ⑥)
M0 토대 → M1 DB마이그레이션 → M2 라이브러리+책추가 → M3 리더+선택 →
M4 AI연동(Edge Function 먼저) → M5 카드저장+단어장(**핵심 루프**) → M6 follow-up+진척 →
M7 플래시카드+통계 → M8 가입유도+PWA(출시 직전).
- 한 슬라이스를 **DB→service→화면까지 관통**(수평 층쌓기 금지).
- 작은 프롬프트는 슬라이스 안에서 데이터→화면 순서로. 슬라이스 끝마다 dev 서버 실행 검증 + 커밋.

## 현재 마일스톤
→ **1차 코딩 완료(M0~M8) + Vercel 배포 + 보안 점검 통과.** 현황·백로그·배포정보는 → [../plan/build_status_v2.md](../plan/build_status_v2.md).
- 배포: https://english-novel-friends.vercel.app (Vercel Root Dir = sentencemate-reader). Edge Function `ask-ai` 배포됨(모델 `gemini-3-flash-preview`).
- 다음(백로그): SE epub 수정(라이선스 조사 선행) → 큐레이션 시드·카탈로그 / 리더 TOC 점프 / 단어장 접기. 그 외 SRS·세션통계·문장컬렉션 등.
- 진행률(pct)은 spine 위치 기반 근사값.

## 알려진 이슈 (의도적 보류)
- **SE(standardebooks) epub 빈 페이지** — epubjs가 SE의 SVG 타이틀페이지 폭을 과측정해 빈 페이지처럼 보임. **리더 코어·다른 epub은 정상**이고 데이터/아키텍처와 무관(useReader.js 렌더 설정 한 곳 문제). 별도 미니태스크로 수정 예정. 그전까지 **테스트는 SE 아닌 epub(Gutenberg 등)으로**.

## 검증
`npm run dev` → 태블릿/폰 브라우저로 실제 흐름 테스트.
