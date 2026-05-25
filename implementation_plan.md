# SentenceMate Reader v2 — 기능 강화 구현 계획서

> **문서 목적:** 웹앱 공개 배포를 위한 기능 강화 구현 상세 계획
>
> **현재 상태:** Vercel 배포 완료 (https://english-novel-friends.vercel.app/)
>
> **작성일:** 2026.04.12

---

## 전체 로드맵 요약

| Phase | 내용 | 예상 작업량 | 핵심 가치 |
|-------|------|-----------|-----------|
| **Phase 1** | 프롬프트 개선 + API 프록시 + 질문 횟수 추적 | 1~2일 | "다른 사람이 바로 쓸 수 있는" 상태 만들기 |
| **Phase 2** | 공개 도서 라이브러리 + PWA 전환 | 1~2일 | "앱처럼 설치 + 열자마자 읽을 수 있는" 경험 |
| **Phase 3** | 읽기 통계 대시보드 | 1~2일 | 학습 동기부여 + 차별화 기능 |
| **Phase 4** | 랜딩 페이지 + 책 추천 서비스 | 2~3일 | 마케팅 + 고급 기능 |

---

## Phase 1: 핵심 인프라 (최우선)

> **목표:** 다른 사람이 API 키 없이도 앱을 바로 사용할 수 있게 만들기

---

### 1.1 프롬프트에 책 제목/작가 전달

**현재 문제:** AI가 사용자가 어떤 책을 읽고 있는지 모름 → 3단계 설명(문화적 맥락, 작가 의도 등)의 품질이 떨어짐

**구현 방안:**

#### [MODIFY] [systemPrompt.js](file:///c:/project/english_Novel_friends/sentencemate-reader/src/utils/systemPrompt.js)

`buildUserMessage()` 함수에 `bookTitle`과 `author` 파라미터 추가:

```diff
-export function buildUserMessage({ selectedText, beforeSentence, afterSentence }) {
+export function buildUserMessage({ selectedText, beforeSentence, afterSentence, bookTitle, author }) {
   let message = ''
+  if (bookTitle) {
+    message += `[원서 정보] ${bookTitle}${author ? ' / ' + author : ''}\n`
+  }
   if (beforeSentence) message += `[앞 문장] ${beforeSentence}\n`
   message += `[선택 문장] ${selectedText}\n`
   if (afterSentence) message += `[뒤 문장] ${afterSentence}\n`
```

시스템 프롬프트 끝에 추가:

```
## 원서 정보 활용

사용자의 메시지에 [원서 정보]가 포함되어 있을 수 있습니다.
이 경우, 해당 작품의 문체, 시대적 배경, 작가의 특징을 고려하여 설명하세요.
예를 들어, 19세기 영국 소설이면 당시 사회적 맥락을 반영하고,
특정 작가의 독특한 문체가 있다면 그것을 짚어주세요.
```

#### [MODIFY] [EpubReader.jsx](file:///c:/project/english_Novel_friends/sentencemate-reader/src/components/EpubReader.jsx)

- epub.js의 `book.package.metadata.creator`에서 작가명 추출
- `callAPI()` 호출 시 `bookTitle`, `author` 전달

**작업량:** ~30분

---

### 1.2 Gemini API 서버 프록시

**현재 문제:** 사용자가 직접 Gemini API 키를 발급받아 입력해야 함 → 일반 사용자에게 진입장벽

**목표:** 앱 소유자의 API 키를 서버에 안전하게 저장하고, 사용자는 키 없이도 AI 기능 사용

**아키텍처:**

```
[사용자 브라우저]
    │
    ▼ POST /api/ask  (선택 문장 + 컨텍스트)
[Vercel Serverless Function]
    │ API 키는 환경변수(GEMINI_API_KEY)에 저장
    │ Rate limiting: IP당 하루 50회
    ▼
[Gemini API] → 스트리밍 응답 → 사용자에게 전달
```

#### [NEW] `api/ask.js` — Vercel Serverless Function

```
sentencemate-reader/
├── api/
│   └── ask.js          ← Serverless Function (서버 프록시)
├── src/
│   └── ...
```

**핵심 코드 구조:**

```javascript
// api/ask.js
export default async function handler(req, res) {
  // 1. Rate limiting (IP 기반, 하루 50회)
  // 2. 요청 body에서 selectedText, context 추출
  // 3. 환경변수의 GEMINI_API_KEY로 Gemini API 호출
  // 4. 스트리밍 응답을 그대로 사용자에게 전달
}
```

**보안 설계:**

| 위협 | 대응 |
|------|------|
| API 키 노출 | 키는 Vercel 환경변수에만 저장. 프론트엔드 코드에 절대 포함 안 됨 |
| 과도한 사용 (비용 폭탄) | IP당 하루 50회 제한 + 전체 하루 1000회 제한 |
| 악의적 프롬프트 주입 | 시스템 프롬프트는 서버에서 주입, 사용자는 선택 문장만 전송 |
| 직접 API 남용 | `/api/ask` 엔드포인트에 CORS 제한 + Origin 검증 |

**비용 예측 (Gemini Flash):**

| 규모 | 일일 호출 | 월 비용 |
|------|----------|---------|
| 혼자 사용 | ~30회 | ~$0.1 (거의 무료) |
| 사용자 10명 | ~300회 | ~$1 |
| 사용자 100명 | ~3000회 | ~$10 |

#### [MODIFY] [useGeminiAPI.js](file:///c:/project/english_Novel_friends/sentencemate-reader/src/hooks/useGeminiAPI.js)

- 사용자 API 키가 있으면 → 기존 방식 (직접 호출)
- API 키가 없으면 → `/api/ask` 프록시 경유 (기본값)
- 두 경로 모두 스트리밍 응답 지원

#### [MODIFY] [SettingsPanel.jsx](file:///c:/project/english_Novel_friends/sentencemate-reader/src/components/SettingsPanel.jsx)

- API 키 입력란을 **선택사항**으로 변경
- "기본 제공 AI를 사용합니다. 본인의 API 키가 있다면 입력하세요." 안내 문구

**Vercel 환경변수 설정 방법:**

```
Vercel Dashboard → Settings → Environment Variables
  GEMINI_API_KEY = "AIzaSy..."  (Production 환경에만 설정)
```

**작업량:** ~3~4시간

---

### 1.3 AI 질문 횟수 추적

**현재 문제:** 사용자가 실력 변화를 체감할 수 없음

**데이터 구조 (localStorage):**

```javascript
// sm_ask_history 키에 저장
[
  {
    bookTitle: "Pride and Prejudice",
    chapter: "Chapter 1",
    page: 15,           // 현재 페이지 번호 
    timestamp: "2026-04-12T14:30:00Z",
    selectedText: "It is a truth universally acknowledged..."
  },
  // ...
]
```

#### [NEW] `src/utils/askHistory.js`

- `recordAsk(bookTitle, chapter, page, selectedText)` — 질문 기록 저장
- `getAskStats(bookTitle)` — 책별 통계 (총 횟수, 페이지별 평균 등)
- `getAskTrend(bookTitle)` — 페이지 구간별 질문 횟수 추이

#### [MODIFY] [EpubReader.jsx](file:///c:/project/english_Novel_friends/sentencemate-reader/src/components/EpubReader.jsx)

- `handleAskAI()` 함수에서 `recordAsk()` 호출 추가

**시각화 (Phase 3에서 구현):**

```
책: Pride and Prejudice
총 질문: 47회

페이지 구간별 질문 횟수:
1~20p   ████████████ 18회
21~40p  ████████ 12회
41~60p  █████ 8회        ← 줄어드는 추세!
61~80p  ████ 6회
81~100p ███ 3회
```

**작업량:** ~1~2시간 (기록 로직만, 시각화는 Phase 3)

---

## Phase 2: 사용자 경험 강화

> **목표:** 앱을 열자마자 바로 읽을 수 있는 경험 + 앱처럼 설치 가능

---

### 2.1 공개 도서 라이브러리

**현재 문제:** 사용자가 직접 ePub 파일을 준비해야 함 → 진입 장벽

**구현 방안:**

#### [NEW] `public/books/` — 공개 도서 저장 디렉토리

```
public/books/
├── catalog.json           ← 도서 목록 메타데이터
├── alice-in-wonderland.epub
├── pride-and-prejudice.epub
├── sherlock-holmes.epub
├── the-great-gatsby.epub
└── peter-pan.epub
```

#### [NEW] `public/books/catalog.json`

```json
[
  {
    "id": "alice-in-wonderland",
    "title": "Alice's Adventures in Wonderland",
    "author": "Lewis Carroll",
    "year": 1865,
    "level": "beginner",
    "levelLabel": "초급",
    "description": "이상한 나라로 떨어진 앨리스의 모험. 짧은 문장, 재미있는 설정으로 영어 원서 입문에 최적.",
    "pages": 80,
    "file": "/books/alice-in-wonderland.epub",
    "source": "Project Gutenberg",
    "coverColor": "#9B59B6"
  },
  // ...
]
```

**난이도 분류 기준:**

| 레벨 | 기준 | 대상 | 예시 |
|------|------|------|------|
| 🟢 초급 (beginner) | 짧은 문장, 일상 어휘, 아동문학 | TOEIC 600 이하 | Alice in Wonderland, Peter Pan |
| 🟡 중급 (intermediate) | 보통 길이, 문학적 표현 있음 | TOEIC 600~800 | The Great Gatsby, Sherlock Holmes |
| 🔴 고급 (advanced) | 복잡한 문장, 문체가 독특 | TOEIC 800+ | Pride and Prejudice, 1984 |

#### [NEW] `src/components/BookLibrary.jsx`

- 카드 형태로 공개 도서 목록 표시
- 난이도별 필터링 (탭 또는 드롭다운)
- 책 카드 클릭 → fetch로 ePub 다운로드 → 바로 리더로 열기
- 기존 FileUploader 화면에 통합 (상단에 라이브러리, 하단에 파일 업로드)

**UI 레이아웃:**

```
┌─────────────────────────────────────┐
│  📚 SentenceMate                    │
│  영어 원서를 읽어보세요               │
│                                     │
│  ── 추천 도서 ──────────────────     │
│  [🟢초급] [🟡중급] [🔴고급] [전체]    │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 📖   │ │ 📖   │ │ 📖   │        │
│  │Alice │ │Gatsby│ │Holmes│        │
│  │초급   │ │중급   │ │중급   │        │
│  │바로읽기│ │바로읽기│ │바로읽기│        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│  ── 내 파일 열기 ──────────────      │
│  ┌─────────────────────────────┐    │
│  │   ePub 파일 선택하기          │    │
│  │   또는 파일을 여기에 드래그    │    │
│  └─────────────────────────────┘    │
│                                     │
│  [단어장]  [설정]                     │
└─────────────────────────────────────┘
```

**초기 도서 후보 (5권):**

| 제목 | 작가 | 난이도 | 선정 이유 |
|------|------|--------|-----------|
| Alice's Adventures in Wonderland | Lewis Carroll | 초급 | 짧고 재미있음, 입문용 최고 |
| Peter Pan | J.M. Barrie | 초급 | 친숙한 이야기, 쉬운 문장 |
| The Adventures of Sherlock Holmes | Arthur Conan Doyle | 중급 | 흥미진진한 추리, 적당한 난이도 |
| The Great Gatsby | F. Scott Fitzgerald | 중급 | 문학적 가치, 적당한 길이 |
| Pride and Prejudice | Jane Austen | 고급 | 영어 원서의 클래식 |

> [!NOTE]
> ePub 파일은 [Project Gutenberg](https://www.gutenberg.org/)와 [Standard Ebooks](https://standardebooks.org/)에서 다운로드 가능. Standard Ebooks는 타이포그래피와 포맷이 더 깔끔하므로 우선 사용.

**Vercel 용량 고려:**
- ePub 1권 ≈ 0.5~3MB
- 5권 ≈ 5~15MB
- Vercel 무료 tier 빌드 출력 상한 256MB → **여유 충분**

**작업량:** ~3~4시간

---

### 2.2 PWA (Progressive Web App) 전환

**현재 문제:** 매번 URL을 브라우저에 입력해야 함. 앱처럼 느껴지지 않음.

**PWA 전환 후:**
- 📱 홈 화면에 앱 아이콘 추가 가능
- 🌐 주소창 없이 전체 화면으로 실행
- 📶 오프라인에서도 기본 UI 로딩 가능 (이미 불러온 책 읽기)
- 💾 캐시된 정적 파일로 빠른 로딩

#### [NEW] `public/manifest.json`

```json
{
  "name": "SentenceMate Reader",
  "short_name": "SentenceMate",
  "description": "AI가 도와주는 영어 원서 읽기",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fefefe",
  "theme_color": "#4A90D9",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### [NEW] `public/sw.js` — Service Worker

- 정적 파일(HTML, CSS, JS) 캐싱 → 오프라인 로딩
- 도서 라이브러리 ePub 파일 캐싱 (선택적)
- API 요청은 캐싱하지 않음 (항상 네트워크)

#### [MODIFY] [index.html](file:///c:/project/english_Novel_friends/sentencemate-reader/index.html)

```diff
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
+ <link rel="manifest" href="/manifest.json" />
+ <meta name="theme-color" content="#4A90D9" />
+ <meta name="apple-mobile-web-app-capable" content="yes" />
+ <meta name="description" content="AI가 도와주는 영어 원서 읽기 - SentenceMate Reader" />
```

#### [NEW] `public/icons/` — 앱 아이콘 세트

- icon-192.png, icon-512.png (생성 도구 또는 AI 이미지 생성 활용)

**작업량:** ~2~3시간

---

## Phase 3: 학습 통계 대시보드

> **목표:** 사용자가 "나 실력이 느는 중이다"를 눈으로 확인

---

### 3.1 읽기 기록 시스템

#### [NEW] `src/utils/readingLog.js`

**데이터 구조:**

```javascript
// sm_reading_log 키에 저장
{
  "2026-04-12": {
    sessions: [
      {
        bookTitle: "Pride and Prejudice",
        startPage: 15,
        endPage: 28,
        startTime: "2026-04-12T14:00:00Z",
        endTime: "2026-04-12T14:45:00Z",
        duration: 2700  // 초 단위 (45분)
      }
    ],
    totalPages: 13,
    totalDuration: 2700
  },
  // ...
}
```

**기록 시점:**
- 페이지 이동(`relocated` 이벤트) 시 현재 페이지 업데이트
- 앱을 열 때 세션 시작 시간 기록
- 앱을 닫거나 책을 바꿀 때 세션 종료 시간 기록
- `beforeunload` 이벤트로 브라우저 종료 시에도 기록 저장

#### [NEW] `src/components/StatsPanel.jsx`

**UI 구성 — 3개 탭:**

**탭 1: 읽기 캘린더 (히트맵)**

```
        4월 읽기 기록
일  월  화  수  목  금  토
         1   2   3   4   5
 6   7   8   9  10  11  12
□   ■   ■   □   ■   ■   ■   ← 색이 진할수록 많이 읽음
13  14  15  16  17  18  19
■   □   ...

이번 주: 총 45페이지, 3시간 20분
연속 읽기: 5일 🔥
```

**탭 2: AI 질문 통계**

```
📊 Pride and Prejudice

총 질문: 47회 | 읽은 페이지: 95p | 페이지당 평균: 0.49회

구간별 추이:
Ch.1~5   ████████████ 2.1회/p
Ch.6~10  ████████ 1.3회/p
Ch.11~15 █████ 0.8회/p      ← 👍 줄어드는 중!

──────────────────────────────
📚 책별 비교
Pride and Prejudice  0.49회/p
Alice in Wonderland  0.22회/p  ← 더 쉬운 책이라 적음
```

**탭 3: 단어장 통계 (기존 단어장 연동)**

```
총 저장 단어: 23개
이번 주 추가: 7개 | 지난 주: 12개
가장 많이 저장한 책: Pride and Prejudice (15개)
```

#### 접근 방법

- 기존 하단 `단어장` 버튼 옆에 `📊 통계` 버튼 추가
- 사이드 패널 형태로 표시 (설정 패널과 동일한 방식)

**작업량:** ~4~6시간

---

## Phase 4: 마케팅 + 고급 기능

> **목표:** 외부 사용자 유입 + 장기적 차별화

---

### 4.1 랜딩 / 설명 페이지

**현재 문제:** URL을 공유받은 사람이 바로 파일 업로드 화면을 보면 "이게 뭐지?" 하고 이탈

**구현 방안:** 앱의 첫 진입점을 랜딩 페이지로 변경 (첫 방문 시만)

#### [NEW] `src/components/LandingPage.jsx`

**섹션 구성:**

```
1. 히어로 섹션
   "영어 원서, 모르는 문장도 막힘없이 읽어보세요"
   [지금 시작하기] 버튼

2. 핵심 기능 소개 (3단계)
   📖 문장 선택 → 📝 AI가 3단계로 설명 → 💡 영어 실력 성장
   (각각 스크린샷 / 애니메이션 GIF)

3. 사용 방법
   간단한 3단계 안내 (큰 아이콘 + 짧은 설명)

4. FAQ
   - "무료인가요?" → 네, 무료입니다
   - "어떤 파일을 열 수 있나요?" → ePub (DRM-free)
   - "API 키가 필요한가요?" → 아니요, 바로 사용 가능

5. 추천 도서 미리보기 (BookLibrary 연결)

6. CTA (Call to Action)
   [지금 원서 읽기 시작] 버튼
```

**첫 방문 감지:** localStorage에 `sm_visited` 플래그 사용

**작업량:** ~3~4시간

---

### 4.2 LLM 기반 책 추천 서비스 (후순위)

> [!IMPORTANT]
> 이 기능은 사용자가 충분히 모인 후 구현합니다. 초기에는 catalog.json의 수동 큐레이션으로 충분합니다.

**구상:**
- 서버리스 API 엔드포인트 `/api/recommend`
- 사용자 입력: "좋아하는 장르", "영어 실력", "이전에 읽은 책"
- LLM이 catalog.json의 도서 목록 중 추천
- 대화형 인터페이스 (채팅 형태)

**작업량:** ~1~2일

---

## 파일 구조 변경 요약

```diff
 sentencemate-reader/
+├── api/
+│   └── ask.js                    ← [NEW] Gemini API 프록시
 ├── public/
+│   ├── manifest.json             ← [NEW] PWA 매니페스트
+│   ├── sw.js                     ← [NEW] Service Worker
+│   ├── icons/                    ← [NEW] 앱 아이콘
+│   │   ├── icon-192.png
+│   │   └── icon-512.png
+│   └── books/                    ← [NEW] 공개 도서 라이브러리
+│       ├── catalog.json
+│       ├── alice-in-wonderland.epub
+│       ├── pride-and-prejudice.epub
+│       ├── sherlock-holmes.epub
+│       ├── the-great-gatsby.epub
+│       └── peter-pan.epub
 ├── src/
 │   ├── App.jsx                   ← [MODIFY] 라우팅 추가 (랜딩/리더)
 │   ├── components/
+│   │   ├── BookLibrary.jsx       ← [NEW] 공개 도서 목록 UI
+│   │   ├── StatsPanel.jsx        ← [NEW] 학습 통계 대시보드
+│   │   ├── LandingPage.jsx       ← [NEW] 랜딩/설명 페이지
 │   │   ├── FileUploader.jsx      ← [MODIFY] BookLibrary 통합
 │   │   ├── SettingsPanel.jsx     ← [MODIFY] API 키 선택사항으로 변경
 │   │   └── EpubReader.jsx        ← [MODIFY] 작가명 추출 + 질문 기록
 │   ├── hooks/
 │   │   └── useGeminiAPI.js       ← [MODIFY] 프록시 경로 추가
 │   ├── utils/
+│   │   ├── askHistory.js         ← [NEW] 질문 횟수 기록/분석
+│   │   ├── readingLog.js         ← [NEW] 읽기 기록 (캘린더용)
 │   │   ├── systemPrompt.js       ← [MODIFY] 책 정보 전달 추가
 │   │   └── storage.js
 │   └── styles/
+│       ├── library.css           ← [NEW] 도서 라이브러리 스타일
+│       ├── stats.css             ← [NEW] 통계 대시보드 스타일
+│       └── landing.css           ← [NEW] 랜딩 페이지 스타일
 ├── index.html                    ← [MODIFY] PWA 메타태그 추가
 └── vite.config.js
```

---

## 의존성 변경

현재 의존성 외에 **추가 패키지 없음**. 모든 기능을 Vanilla JS/CSS + React로 구현합니다.

| 기능 | 구현 방식 | 외부 라이브러리 |
|------|-----------|----------------|
| 캘린더 히트맵 | CSS Grid로 직접 구현 | 없음 |
| 차트 (바 차트) | CSS + div 기반으로 직접 구현 | 없음 |
| PWA | manifest.json + Service Worker 직접 작성 | 없음 |
| API 프록시 | Vercel Serverless Functions (내장 기능) | 없음 |

---

## 검증 계획

### Phase 1 검증

- [ ] 프롬프트에 책 제목/작가가 전달되는지 확인 (Gemini 응답에서 작품 맥락 언급 여부)
- [ ] API 프록시가 스트리밍 응답을 정상 전달하는지 확인
- [ ] API 키 없는 사용자도 AI 기능을 사용할 수 있는지 확인
- [ ] Rate limiting이 정상 작동하는지 확인 (50회 초과 시 차단)
- [ ] AI 질문 기록이 localStorage에 저장되는지 확인

### Phase 2 검증

- [ ] 공개 도서 카드 클릭 → ePub 다운로드 → 리더에서 정상 렌더링
- [ ] PWA: 모바일 크롬에서 "홈 화면에 추가" → 전체 화면 실행
- [ ] PWA: 오프라인에서 앱 기본 UI 로딩 확인

### Phase 3 검증

- [ ] 캘린더 히트맵에 읽기 기록 정상 표시
- [ ] 페이지 구간별 질문 횟수 차트 정확성
- [ ] 책별 비교 통계 정확성

### Phase 4 검증

- [ ] 처음 방문자에게 랜딩 페이지 표시, 재방문 시 바로 앱
- [ ] 랜딩 페이지 CTA → 앱 화면 전환

---

## Open Questions

> [!IMPORTANT]
> 1. **Phase 1부터 순서대로 진행할까요, 아니면 특정 기능을 먼저 원하시나요?**
> 2. **API 비용 한도:** 월 최대 얼마까지 Gemini API 비용을 부담할 의향이 있으신가요? (rate limiting 설정 기준)
> 3. **공개 도서 라이브러리:** 위에 제시한 5권 외에 특별히 넣고 싶은 책이 있나요?
