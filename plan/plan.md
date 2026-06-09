# SentenceMate Reader — MVP 프로토타입 구현 계획서

> **문서 목적:** AI 코딩 에이전트가 모호함 없이 실행할 수 있는 수준의 상세 구현 계획
>
> **프로젝트 성격:** 빠르게 만드는 개인 사용용 프로토타입 (추후 정식 앱으로 재구현 예정)
>
> **작성일:** 2026.04.06

---

## 1. 프로젝트 개요

### 한 줄 요약

사용자가 ePub 영어 원서를 웹 브라우저에서 읽으면서, 모르는 문장을 선택하면 AI가 3단계 구조로 설명해주는 웹 리더 앱.

### 핵심 사용 흐름

```
ePub 파일 열기 → 소설 읽기 → 모르는 문장 롱탭/드래그로 선택
→ "Ask AI" 플로팅 버튼 표시 → 버튼 클릭
→ Gemini API 호출 (선택 문장 + 앞뒤 1문장 컨텍스트 자동 포함)
→ 바텀시트에 3단계 응답 스트리밍 표시
→ 바텀시트 닫기 → 원서 읽기 계속
```

### 이 프로토타입의 범위

| 포함 | 미포함 |
|------|--------|
| ePub 파일 열기/렌더링 | 사용자 계정/인증 |
| 텍스트 선택 → AI 설명 | 서버 프록시 |
| 바텀시트 3단계 응답 표시 | 학습 캐싱/단어장 |
| 스트리밍 응답 | 능동적 학습자 모드 |
| 파일 업로드 기능 | 복습/대시보드 |
| Gemini API 직접 호출 (BYOK) | 수익화/결제 |
| 기본적인 읽기 설정 (폰트 크기 등) | PDF/txt 지원 |

---

## 2. 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| **프레임워크** | Vite + React | AI 에이전트 코드 생성 품질 최고, 개발 속도 최빠름 |
| **언어** | JavaScript (또는 TypeScript) | 생태계 넓음, epub.js와 호환 |
| **ePub 렌더링** | epub.js | 가장 성숙한 웹 기반 ePub 라이브러리 |
| **LLM API** | Google Gemini Flash 3.0 | 비용 효율적, 한국어 품질 양호 |
| **스타일링** | Vanilla CSS | 프레임워크 의존 최소화 |
| **서버** | 없음 (클라이언트 전용) | 개인 사용, 빠른 구축 목적 |
| **DB** | 없음 | 파일은 브라우저 메모리에서 처리 |
| **배포** | 로컬 개발 서버 또는 Vercel/Netlify | 개인 사용이므로 로컬로 충분 |

### 서버/DB가 없는 이유

- 개인 사용 프로토타입이므로 서버 운영 불필요
- ePub 파일은 브라우저 메모리에서 epub.js가 직접 파싱/렌더링
- Gemini API는 클라이언트에서 직접 호출 (BYOK 방식)
- API 키는 앱 내 설정 화면에서 입력, localStorage에 저장

---

## 3. 프로젝트 파일 구조

```
sentencemate-reader/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── (favicon 등 정적 파일)
├── src/
│   ├── main.jsx                  # 앱 엔트리포인트
│   ├── App.jsx                   # 메인 앱 컴포넌트
│   ├── index.css                 # 글로벌 스타일 (디자인 시스템)
│   ├── components/
│   │   ├── FileUploader.jsx      # ePub 파일 업로드 컴포넌트
│   │   ├── EpubReader.jsx        # epub.js 래핑, ePub 렌더링 + 텍스트 선택 처리
│   │   ├── AskAIButton.jsx       # 텍스트 선택 시 나타나는 플로팅 버튼
│   │   ├── BottomSheet.jsx       # AI 응답 표시 바텀시트
│   │   ├── AIResponse.jsx        # 3단계 응답 렌더링 (접기/펼치기)
│   │   ├── SettingsPanel.jsx     # API 키 입력 + 읽기 설정
│   │   └── ReaderToolbar.jsx     # 상단 툴바 (목차, 설정 등)
│   ├── hooks/
│   │   ├── useTextSelection.js   # 텍스트 선택 감지 + 주변 문장 추출
│   │   ├── useGeminiAPI.js       # Gemini API 호출 + 스트리밍 처리
│   │   └── useBottomSheet.js     # 바텀시트 상태 관리 (높이, 열림/닫힘)
│   ├── utils/
│   │   ├── sentenceExtractor.js  # 문장 경계 판별 + 앞뒤 문장 추출 로직
│   │   ├── systemPrompt.js       # 시스템 프롬프트 v0.2 텍스트
│   │   └── storage.js            # localStorage 유틸 (API 키, 설정 저장)
│   └── styles/
│       ├── reader.css            # ePub 리더 영역 스타일
│       ├── bottomSheet.css       # 바텀시트 스타일 + 애니메이션
│       └── components.css        # 기타 컴포넌트 스타일
```

---

## 4. 핵심 컴포넌트별 상세 명세

---

### 4.1 FileUploader.jsx — 파일 업로드

**역할:** 사용자가 ePub 파일을 선택하면 브라우저 메모리에 로드

**동작:**
1. 앱 최초 진입 시 또는 파일이 로드되지 않은 상태에서 표시
2. `<input type="file" accept=".epub">` 사용
3. 드래그 앤 드롭도 지원 (선택사항, 있으면 좋음)
4. 파일 선택 시 `FileReader API`로 `ArrayBuffer`로 읽기
5. 읽은 데이터를 `EpubReader` 컴포넌트에 전달

**UI:**
- 화면 중앙에 파일 업로드 영역 표시
- "ePub 파일을 선택하세요" 안내 텍스트 + 파일 선택 버튼
- 깔끔하고 미니멀한 디자인

**상태 관리:**
- 파일 데이터는 React state로 관리 (`useState`로 `ArrayBuffer` 보관)
- 파일이 로드되면 자동으로 리더 화면으로 전환

---

### 4.2 EpubReader.jsx — ePub 렌더링 + 텍스트 선택

**역할:** epub.js로 ePub 파일을 렌더링하고, 텍스트 선택 이벤트를 처리

**epub.js 초기화:**
```javascript
import ePub from 'epubjs';

// 파일 데이터(ArrayBuffer)로 Book 생성
const book = ePub(arrayBuffer);

// 렌더링 영역에 표시
const rendition = book.renderTo(viewerRef.current, {
  width: '100%',
  height: '100%',
  flow: 'paginated',     // 페이지 넘김 모드 (스크롤 모드도 가능)
  spread: 'none'         // 한 페이지씩 표시
});

rendition.display();
```

**페이지 넘김:**
- 좌/우 스와이프 또는 화면 양쪽 터치로 페이지 이동
- `rendition.prev()` / `rendition.next()` 호출
- 현재 위치(CFI)를 localStorage에 저장하여 마지막 읽던 위치 기억 (선택사항)

**텍스트 선택 처리:**
- epub.js의 rendition 내부 iframe에서 `mouseup`/`touchend` 이벤트 감지
- 선택된 텍스트가 있으면 `AskAIButton` 표시
- 선택 영역의 좌표를 가져와 버튼 위치 결정

**커스텀 스타일 주입:**
```javascript
rendition.themes.default({
  body: {
    'font-family': '"Georgia", serif',
    'font-size': '18px',
    'line-height': '1.8',
    'color': '#333',
    'padding': '20px'
  }
});
```

---

### 4.3 useTextSelection.js — 텍스트 선택 + 주변 문장 추출

**역할:** 텍스트 선택 감지, 선택된 텍스트 추출, 앞뒤 1문장 자동 추출

**반환값:**
```javascript
{
  selectedText: string,       // 사용자가 선택한 텍스트
  beforeSentence: string,     // 선택 문장 앞 1문장
  afterSentence: string,      // 선택 문장 뒤 1문장
  selectionRect: DOMRect,     // 선택 영역 좌표 (버튼 위치용)
  clearSelection: function    // 선택 해제 함수
}
```

**문장 경계 판별 로직 (sentenceExtractor.js):**
```javascript
// 문장 분리 정규식 — 약어(Mr. Mrs. Dr. St. etc.)는 분리하지 않음
const SENTENCE_SPLIT_REGEX = /(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|etc|vs|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\.\s+|[!?]\s+/;

function extractContext(fullText, selectedText) {
  const sentences = fullText.split(SENTENCE_SPLIT_REGEX);
  const selectedIndex = sentences.findIndex(s => s.includes(selectedText));

  return {
    before: selectedIndex > 0 ? sentences[selectedIndex - 1] : '',
    selected: sentences[selectedIndex] || selectedText,
    after: selectedIndex < sentences.length - 1 ? sentences[selectedIndex + 1] : ''
  };
}
```

**주변 텍스트 가져오는 방법:**
1. `window.getSelection().anchorNode.parentElement`로 선택 문장이 속한 `<p>` 태그 참조
2. 해당 `<p>`의 `textContent`에서 문장 분리
3. 선택 문장이 `<p>` 태그의 첫 문장이면 → 이전 `<p>` 태그의 마지막 문장을 `beforeSentence`로 사용
4. 선택 문장이 `<p>` 태그의 마지막 문장이면 → 다음 `<p>` 태그의 첫 문장을 `afterSentence`로 사용

---

### 4.4 AskAIButton.jsx — 플로팅 "Ask AI" 버튼

**역할:** 텍스트 선택 시 선택 영역 근처에 나타나는 버튼

**동작:**
1. 텍스트가 선택되면 선택 영역의 **바로 위** 또는 **바로 아래**에 버튼 표시
2. 선택 영역이 화면 상단에 있으면 → 아래에 표시
3. 선택 영역이 화면 하단에 있으면 → 위에 표시
4. 버튼 클릭 시 → `useGeminiAPI` 호출 + 바텀시트 열기
5. 다른 곳 터치하여 선택 해제 시 → 버튼 사라짐

**UI:**
- 작은 둥근 버튼 또는 알약 모양 버튼
- "Ask AI" 또는 "📖 설명" 텍스트
- 부드러운 fade-in 애니메이션
- 그림자(box-shadow)로 떠 있는 느낌

**위치 계산:**
```javascript
// 선택 영역 좌표 기반 버튼 위치 결정
const rect = selectionRect;
const buttonTop = rect.top > 60
  ? rect.top - 45     // 선택 영역 위에 표시
  : rect.bottom + 10; // 선택 영역 아래에 표시
const buttonLeft = rect.left + (rect.width / 2); // 수평 중앙
```

---

### 4.5 BottomSheet.jsx — 바텀시트

**역할:** AI 응답을 표시하는 하단 패널

**핵심 동작:**
1. Ask AI 버튼 클릭 시 → 화면 아래에서 위로 슬라이드 업 (300ms 애니메이션)
2. 기본 높이: 화면의 **45%**
3. 드래그 핸들을 위로 끌면 → 최대 화면의 **85%**까지 확장
4. 드래그 핸들을 아래로 끌면 → 닫힘

**닫기 방법 (2가지만):**
- 우측 상단 **X 버튼** 터치
- 드래그 핸들을 **아래로 스와이프**
- ⚠️ 바깥 영역 터치로는 닫히지 않음 (실수 방지)

**스크롤 자동 조정 로직:**
```
바텀시트가 올라올 때:
1. 선택한 문장의 화면 내 Y좌표를 확인
2. 바텀시트의 상단 경계선(화면 높이의 55% 지점)과 비교
3. 문장 Y좌표 > 바텀시트 상단 → 문장이 가려짐 → 스크롤하여 문장을 바텀시트 위로 이동
4. 문장 Y좌표 < 바텀시트 상단 → 이미 보임 → 스크롤 안 함
```

**구현 방식:**
```javascript
// 바텀시트가 열릴 때 실행
function adjustScrollIfNeeded(selectedElement) {
  const sentenceY = selectedElement.getBoundingClientRect().bottom;
  const sheetTop = window.innerHeight * 0.55;

  if (sentenceY > sheetTop) {
    selectedElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
```

**UI 상세:**
```
┌─────────────────────────────┐
│ ━━━━ (드래그 핸들)       ✕  │  ← 핸들: 너비 40px, 중앙 정렬, 회색
│                             │     X 버튼: 우측 상단
│  [AI 응답 내용 영역]         │
│  - 스크롤 가능               │
│  - 스트리밍 중일 때 로딩 표시  │
│                             │
└─────────────────────────────┘
```

**스타일:**
- 배경: 흰색 또는 매우 연한 회색 (#fafafa)
- 상단 모서리: border-radius 16px
- 그림자: 위쪽으로 부드러운 box-shadow
- 바텀시트가 올라올 때, 뒤의 소설 영역은 약간 어두워짐 (rgba(0,0,0,0.3) 오버레이)

---

### 4.6 AIResponse.jsx — 3단계 응답 렌더링

**역할:** Gemini API 응답을 3단계 구조로 파싱하여 표시

**응답 파싱 로직:**
- Gemini 응답 텍스트에서 `📖`, `📝`, `💡` 이모지 또는 `---` 구분선을 기준으로 3단계 분리
- 각 단계를 별도의 섹션으로 렌더링

**표시 규칙:**
| 단계 | 기본 상태 | 동작 |
|------|-----------|------|
| 📖 1단계: 직독직해 | **펼침 (기본 노출)** | 항상 보임 |
| 📝 2단계: 자연스러운 해석 | **접힘** | 탭하면 펼침/접힘 토글 |
| 💡 3단계: 영어식 사고방식 | **접힘** | 탭하면 펼침/접힘 토글 |

**접기/펼치기 UI:**
```
📖 1단계: 직독직해
  **The fact** → 그 사실
  **that** → (어떤 사실이냐면)
  ...

▶ 📝 2단계: 자연스러운 해석     ← 탭하면 펼침
▶ 💡 3단계: 영어식 사고방식      ← 탭하면 펼침
```

**스트리밍 표시:**
- 응답이 스트리밍 중일 때 텍스트가 타이핑되듯이 나타남
- 각 단계가 완성될 때마다 자연스럽게 다음 단계 영역 생성
- 스트리밍 중 표시: 커서 깜빡임 효과 또는 간단한 로딩 인디케이터

**마크다운 렌더링:**
- 응답 내 **굵게(bold)** 처리된 텍스트를 HTML `<strong>`으로 변환
- `→` 화살표 등 특수 기호 그대로 표시
- 가독성 좋은 폰트와 줄간격 적용

---

### 4.7 useGeminiAPI.js — Gemini API 호출 + 스트리밍

**역할:** Gemini Flash 3.0 API에 스트리밍 요청 전송

**API 호출 구조:**
```javascript
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';

async function callGeminiStream({ apiKey, systemPrompt, userMessage, onChunk, onDone }) {
  const response = await fetch(`${API_URL}?key=${apiKey}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: [{ text: userMessage }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })
  });

  // 스트리밍 응답 처리
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // SSE 파싱하여 텍스트 추출
    onChunk(parsedText);
  }

  onDone();
}
```

**사용자 메시지 구성:**
```javascript
function buildUserMessage({ selectedText, beforeSentence, afterSentence }) {
  let message = '';

  if (beforeSentence) {
    message += `[앞 문장] ${beforeSentence}\n`;
  }

  message += `[선택 문장] ${selectedText}\n`;

  if (afterSentence) {
    message += `[뒤 문장] ${afterSentence}\n`;
  }

  message += '\n위의 [선택 문장]을 설명해주세요. [앞 문장]과 [뒤 문장]은 맥락 참고용입니다.';

  return message;
}
```

**에러 처리:**
- API 키 미설정: "설정에서 Gemini API 키를 입력해주세요" 안내
- 네트워크 오류: "인터넷 연결을 확인해주세요" 안내
- API 에러 (429 등): "잠시 후 다시 시도해주세요" 안내

---

### 4.8 SettingsPanel.jsx — 설정 화면

**역할:** API 키 입력 + 기본 읽기 설정

**설정 항목:**
| 항목 | 타입 | 기본값 | 저장 위치 |
|------|------|--------|-----------|
| Gemini API 키 | 텍스트 입력 (마스킹) | 없음 (필수 입력) | localStorage |
| 폰트 크기 | 슬라이더 (14~28px) | 18px | localStorage |
| 줄간격 | 슬라이더 (1.4~2.2) | 1.8 | localStorage |
| 테마 | 선택 (밝음/세피아/다크) | 밝음 | localStorage |

**접근 방법:**
- 상단 툴바의 설정 아이콘(⚙️) 클릭으로 열기
- 사이드 패널 또는 모달로 표시

---

### 4.9 ReaderToolbar.jsx — 상단 툴바

**역할:** 네비게이션 + 설정 접근

**포함 요소:**
```
┌──────────────────────────────────────┐
│  ← (뒤로/파일선택)  📖 책 제목    ⚙️  │
└──────────────────────────────────────┘
```

- 왼쪽: 뒤로가기 (파일 선택 화면으로) 또는 목차 열기
- 중앙: 현재 책 제목 표시 (epub 메타데이터에서 추출)
- 오른쪽: 설정 아이콘

**자동 숨김 (선택사항):**
- 소설 읽는 중에는 툴바 숨김
- 화면 상단 터치 시 나타남
- 이 기능은 MVP에서 구현하지 않아도 됨 (있으면 좋음)

---

## 5. 시스템 프롬프트

시스템 프롬프트는 `src/utils/systemPrompt.js`에 별도 파일로 관리합니다.

**내용:** `SentenceMate_시스템프롬프트_v0.2.md` 파일의 "시스템 프롬프트 본문" 섹션 (코드 블록 안의 텍스트)을 그대로 사용합니다.

**추가 지침 (앞뒤 문장 컨텍스트 관련):**
시스템 프롬프트 끝에 다음 내용을 추가합니다:

```
---

## 맥락 정보 활용

사용자의 메시지에 [앞 문장]과 [뒤 문장]이 포함되어 있을 수 있습니다.
이 경우, [선택 문장]을 중심으로 설명하되, 앞뒤 문장을 맥락 파악에 참고하세요.
앞뒤 문장 자체를 별도로 설명할 필요는 없습니다. 선택 문장의 이해를 돕는 데만 활용하세요.
```

---

## 6. UI/UX 상세 명세

### 6.1 전체 화면 구조

**상태 1: 파일 미로드 (초기 화면)**
```
┌──────────────────────────────┐
│                              │
│                              │
│       📚 SentenceMate        │
│                              │
│    영어 원서를 읽어보세요       │
│                              │
│   ┌──────────────────────┐   │
│   │   ePub 파일 선택하기    │   │
│   └──────────────────────┘   │
│                              │
│   또는 파일을 여기에 드래그    │
│                              │
│                              │
│          ⚙️ 설정             │
│                              │
└──────────────────────────────┘
```

**상태 2: 소설 읽기 중**
```
┌──────────────────────────────┐
│ ←   Rivers of London     ⚙️  │  ← 툴바
├──────────────────────────────┤
│                              │
│  소설 텍스트가 여기에 렌더링    │
│                              │
│  사용자가 이 영역에서          │
│  텍스트를 선택할 수 있음       │
│                              │
│                              │
│       ◀  페이지  ▶           │  ← 좌우 터치 또는 스와이프
│                              │
└──────────────────────────────┘
```

**상태 3: 텍스트 선택 후 Ask AI 버튼 표시**
```
┌──────────────────────────────┐
│ ←   Rivers of London     ⚙️  │
├──────────────────────────────┤
│                              │
│  소설 텍스트 ...              │
│                              │
│  ████선택된 텍스트████        │  ← 파란색 하이라이트
│       ┌──────────┐           │
│       │ 📖 Ask AI │           │  ← 플로팅 버튼
│       └──────────┘           │
│                              │
│                              │
└──────────────────────────────┘
```

**상태 4: 바텀시트 열림 (AI 응답 표시)**
```
┌──────────────────────────────┐
│ ←   Rivers of London     ⚙️  │
├──────────────────────────────┤
│                              │
│  소설 텍스트 ...              │
│  ████선택된 텍스트████        │  ← 스크롤 조정으로 보이는 위치
│                              │
│ ▒▒▒▒▒ (반투명 오버레이) ▒▒▒▒▒ │
├──────────────────────────────┤
│  ━━━━                    ✕   │  ← 드래그 핸들 + 닫기 버튼
│                              │
│  📖 1단계: 직독직해            │
│  **The fact** → 그 사실      │
│  ...                        │
│                              │
│  ▶ 📝 2단계: 자연스러운 해석    │  ← 접힌 상태, 탭하면 펼침
│  ▶ 💡 3단계: 영어식 사고방식    │  ← 접힌 상태, 탭하면 펼침
│                              │
└──────────────────────────────┘
```

### 6.2 테마/색상

**밝은 테마 (기본):**
- 배경: #fefefe
- 텍스트: #2c2c2c
- 바텀시트 배경: #ffffff
- 바텀시트 그림자: 0 -4px 20px rgba(0,0,0,0.1)
- 오버레이: rgba(0,0,0,0.25)
- 액센트 (Ask AI 버튼 등): #4A90D9 (차분한 블루)

**세피아 테마:**
- 배경: #f4ecd8
- 텍스트: #5c4b37

**다크 테마:**
- 배경: #1a1a2e
- 텍스트: #e0e0e0

### 6.3 폰트

- 소설 본문: `'Georgia', 'Times New Roman', serif` (가독성 좋은 세리프)
- UI 요소 (버튼, 설정 등): `'Pretendard', 'Apple SD Gothic Neo', sans-serif`
- AI 응답 본문: `'Pretendard', sans-serif` (한국어 가독성)
- AI 응답 내 영어 청크: `'Georgia', serif` (소설 폰트와 일관성)

### 6.4 애니메이션

| 요소 | 애니메이션 | 시간 |
|------|-----------|------|
| 바텀시트 열림 | 아래→위 slide up | 300ms ease-out |
| 바텀시트 닫힘 | 위→아래 slide down | 250ms ease-in |
| Ask AI 버튼 나타남 | fade in + 약간 scale up | 200ms |
| Ask AI 버튼 사라짐 | fade out | 150ms |
| 2단계/3단계 펼침 | 높이 expand | 250ms ease-out |
| 오버레이 나타남 | fade in | 300ms |
| 스크롤 조정 | smooth scroll | 브라우저 기본 |

---

## 7. 구현 순서 (Phase별)

### Phase 0: 프로젝트 초기화
1. Vite + React 프로젝트 생성
2. epub.js 패키지 설치 (`npm install epubjs`)
3. 기본 폴더 구조 생성
4. 글로벌 CSS (디자인 시스템) 작성

### Phase 1: ePub 리더 구현
1. `FileUploader.jsx` — ePub 파일 선택/로드
2. `EpubReader.jsx` — epub.js로 파일 렌더링
3. 페이지 넘김 기능 (좌/우)
4. `ReaderToolbar.jsx` — 상단 툴바 (최소 기능)
5. 기본 읽기 스타일 적용

### Phase 2: 텍스트 선택 + Ask AI
1. `useTextSelection.js` — 텍스트 선택 감지 + 주변 문장 추출
2. `sentenceExtractor.js` — 문장 경계 판별 로직
3. `AskAIButton.jsx` — 플로팅 버튼 표시

### Phase 3: AI 응답 표시
1. `BottomSheet.jsx` — 바텀시트 UI + 드래그 + 애니메이션
2. `useGeminiAPI.js` — Gemini API 스트리밍 호출
3. `AIResponse.jsx` — 3단계 응답 파싱 + 렌더링 (접기/펼치기)
4. `systemPrompt.js` — 시스템 프롬프트 텍스트
5. 바텀시트 열릴 때 스크롤 자동 조정 로직

### Phase 4: 설정 + 마무리
1. `SettingsPanel.jsx` — API 키 입력 + 읽기 설정
2. localStorage 연동 (API 키, 폰트 크기, 테마 등)
3. 에러 처리 (API 키 미설정, 네트워크 오류 등)
4. 전체 UI 폴리싱 (애니메이션, 반응형 레이아웃)
5. 샘플 ePub 파일(`1_Rivers_of_London.epub`)로 통합 테스트

---

## 8. 핵심 주의사항 (코딩 에이전트용)

### epub.js 관련
- epub.js는 내부적으로 **iframe**을 사용하여 콘텐츠를 렌더링함
- 텍스트 선택 이벤트는 **iframe 내부**에서 감지해야 함
- `rendition.on('selected', callback)` 이벤트를 활용하면 epub.js가 텍스트 선택을 자동 감지해줌
- epub.js 버전: `^0.3` 사용 권장 (최신 안정 버전 확인)

### Gemini API 관련
- 클라이언트에서 직접 호출하므로 API 키가 브라우저에 노출됨 → **개인 사용이므로 허용**
- 추후 서버 프록시로 전환 시 `useGeminiAPI.js`의 엔드포인트만 변경하면 됨
- 스트리밍: `alt=sse` 파라미터 사용, Server-Sent Events 형식으로 응답 수신

### 모바일/태블릿 대응
- 모든 터치 이벤트는 `touch` 이벤트와 `mouse` 이벤트 모두 처리
- viewport meta 태그 필수: `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">`
- 바텀시트 드래그는 `touchstart`, `touchmove`, `touchend` 이벤트 사용

### 성능
- ePub 파일은 현재 챕터만 렌더링 (epub.js 기본 동작)
- AI 응답 스트리밍 중 불필요한 리렌더링 최소화 (`useRef` 활용)
- 이미지가 많은 ePub의 경우 lazy loading 고려

---

## 9. 테스트 계획

### 기능 테스트
- [ ] ePub 파일 로드 및 렌더링 (`1_Rivers_of_London.epub`)
- [ ] 페이지 넘김 (좌/우)
- [ ] 텍스트 선택 → Ask AI 버튼 표시
- [ ] Ask AI 클릭 → 바텀시트 열림 + API 호출
- [ ] 스트리밍 응답 표시
- [ ] 3단계 접기/펼치기
- [ ] 바텀시트 닫기 (X 버튼, 스와이프 다운)
- [ ] 바텀시트 열림 시 스크롤 자동 조정
- [ ] 설정 저장/불러오기 (API 키, 폰트 크기, 테마)
- [ ] 에러 처리 (API 키 미설정, 네트워크 오류)

### 디바이스 테스트
- [ ] PC 브라우저 (Chrome)
- [ ] 태블릿 브라우저 (Chrome/Samsung Internet)
- [ ] 모바일 브라우저 (Chrome)

---

## 10. 참조 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 프로젝트 종합정리 | `SentenceMate_프로젝트_종합정리.md` | 전체 프로젝트 맥락, 교육 철학, 로드맵 |
| 시스템 프롬프트 v0.2 | `SentenceMate_시스템프롬프트_v0.2.md` | AI 응답 생성에 사용할 시스템 프롬프트 원문 |
| 샘플 ePub | `1_Rivers_of_London.epub` | 개발/테스트용 영어 원서 파일 |
| 이 문서 | `plan.md` | 구현 계획서 |
