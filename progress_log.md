# SentenceMate Reader — 개발 진행 기록

> 작성일: 2026-04-07
> 프로젝트 경로: `C:\project\english_Novel_friends\sentencemate-reader`

---

## 프로젝트 개요

영어 원서(ePub)를 읽으면서 이해가 안 되는 문장을 선택하면 Gemini AI가 3단계로 설명해주는 웹앱.

- **스택**: Vite + React (JavaScript), epub.js, Google Gemini API
- **로컬 실행**: `npm run dev` → http://localhost:5173
- **네트워크 실행(모바일)**: `npm run dev -- --host` → http://192.168.x.x:5173

---

## 파일 구조

```
sentencemate-reader/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── FileUploader.jsx       # ePub 파일 업로드 화면
│   │   ├── EpubReader.jsx         # 핵심 리더 컴포넌트
│   │   ├── ReaderToolbar.jsx      # 상단 바 (뒤로가기, 제목, 설정)
│   │   ├── AskAIButton.jsx        # 텍스트 선택 시 나타나는 버튼
│   │   ├── BottomSheet.jsx        # AI 응답 바텀시트
│   │   ├── AIResponse.jsx         # AI 응답 파싱 및 렌더링
│   │   └── SettingsPanel.jsx      # 설정 패널
│   ├── hooks/
│   │   ├── useTextSelection.js    # epub 텍스트 선택 감지 훅
│   │   └── useGeminiAPI.js        # Gemini API SSE 스트리밍 훅
│   ├── utils/
│   │   ├── storage.js             # localStorage 설정 저장/불러오기
│   │   ├── systemPrompt.js        # Gemini 시스템 프롬프트 + 유저 메시지 빌더
│   │   └── sentenceExtractor.js   # 앞뒤 문장 추출 유틸
│   └── styles/
│       ├── global.css             # 전역 스타일, CSS 변수 (테마)
│       ├── reader.css             # 리더 레이아웃 스타일
│       ├── components.css         # 컴포넌트별 스타일
│       └── bottomSheet.css        # 바텀시트 및 AI 응답 스타일
```

---

## 구현 단계별 기록

### Phase 1 — 프로젝트 셋업 + 파일 업로드 + ePub 렌더링

**구현 내용**
- Vite + React 프로젝트 생성
- `epubjs` npm 패키지 설치
- `FileUploader.jsx`: 드래그 앤 드롭 or 파일 선택으로 `.epub` 업로드
- `EpubReader.jsx`: epub.js로 렌더링, 페이지 앞뒤 이동 (화살표 버튼 + 키보드 방향키)
- `ReaderToolbar.jsx`: 상단 바 (← 뒤로, 책 제목, ⚙ 설정 버튼)
- 페이지 번호 표시 (하단 `현재페이지 / 전체페이지`)

**핵심 기술**
- epub.js `book.renderTo(el, { flow: 'paginated', spread: 'none' })`
- `rendition.on('relocated', ...)` 로 페이지 번호 업데이트

---

### Phase 2 — 텍스트 선택 감지 + Ask AI 버튼

**구현 내용**
- `useTextSelection.js` 훅: epub.js `rendition.on('selected', ...)` 이벤트로 선택 감지
- iframe 내부 선택 영역 좌표 → 뷰포트 좌표 변환 (iframe offset 보정)
- `AskAIButton.jsx`: 선택 시 툴바 우측 상단에 고정 표시, fade-in 애니메이션
- `sentenceExtractor.js`: 선택 문장이 속한 단락에서 앞뒤 문장 추출

**버그 수정**
- 외부 클릭 시 Ask AI 버튼 사라지지 않는 문제
  → `window.addEventListener('mousedown', ...)` + `window.addEventListener('touchstart', ...)` 로 해결
  → epub 내부 클릭은 `rendition.on('click', ...)` 으로 별도 처리

**핵심 기술**
```javascript
// iframe 좌표 → 뷰포트 좌표 변환
const iframeOffset = iframe.getBoundingClientRect()
const viewportRect = {
  top: iframeRect.top + iframeOffset.top,
  left: iframeRect.left + iframeOffset.left,
  ...
}
```

---

### Phase 3 — Gemini API 연동 + 바텀시트

**구현 내용**
- `useGeminiAPI.js`: Gemini API SSE 스트리밍 (`?alt=sse`)
- `BottomSheet.jsx`: 아래에서 슬라이드업, 드래그로 높이 조절 (45%~85%), X 버튼 닫기
- API 키: `localStorage.setItem('gemini_api_key', 'YOUR_KEY')` 로 임시 저장

**버그 수정**
- Gemini API 404 오류: `gemini-2.0-flash` deprecated
  → 모델 ID를 `gemini-3-flash-preview` 로 변경

**핵심 기술 — SSE 부분 JSON 버퍼 처리**
```javascript
buffer += decoder.decode(value, { stream: true })
const lines = buffer.split('\n')
buffer = lines.pop() // 마지막 불완전 라인은 버퍼에 보관
for (const line of lines) {
  if (!line.startsWith('data: ')) continue
  const parsed = JSON.parse(line.slice(6).trim())
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
  if (text) onChunk(text)
}
```

---

### Phase 4 — AI 응답 파싱 + 3단계 접기/펼치기

**구현 내용**
- `AIResponse.jsx`: 응답 텍스트를 3단계(📖/📝/💡)로 파싱
- 각 단계 접기/펼치기 (CSS grid 트릭으로 부드러운 높이 애니메이션)
- `**text**` → `<strong>` bold 렌더링
- 선택 문장 헤더 표시 ("선택한 문장" + 본문)

**버그 수정**
- 바텀시트 클릭 시 선택 문장이 사라지는 문제
  → `sheetSelectedText` state를 별도로 유지 (Ask AI 클릭 시점에 복사)

**핵심 기술 — CSS grid 높이 애니메이션**
```css
.ai-stage-body-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}
.ai-stage-body-wrapper.open {
  grid-template-rows: 1fr;
}
.ai-stage-body {
  overflow: hidden;
}
```

**파싱 구조**
```
📖 1단계: 직독직해
(내용)
---
📝 2단계: 자연스러운 해석
(내용)
---
💡 3단계: 영어식 사고방식 & 배경지식
(내용)
```
- `\n\s*---\s*\n` 정규식으로 구분
- 이모지(📖/📝/💡) 포함 여부로 단계 헤더 감지

---

### Phase 5 — 설정 패널 + 테마 + 폰트/줄간격

**구현 내용**
- `SettingsPanel.jsx`: 슬라이드업 모달
  - Gemini API 키 입력 (password 타입 + 👁 토글)
  - 폰트 크기 슬라이더 (14~28px)
  - 줄간격 슬라이더 (1.4~2.2)
  - 테마 버튼 3종 (밝음 / 세피아 / 다크)
  - 저장 버튼 (API 키 미입력 시 경고)
- `storage.js`: localStorage에 설정 영속화
- CSS custom properties (`data-theme` 속성) 로 전역 테마 적용

**localStorage 키**
| 설정 | 키 |
|------|----|
| API 키 | `gemini_api_key` |
| 폰트 크기 | `sm_font_size` |
| 줄간격 | `sm_line_height` |
| 테마 | `sm_theme` |

**버그 수정 — 폰트 크기 epub 내부 적용 안 되는 문제**
epub 파일은 자체 CSS에서 `p`, `span` 등에 직접 `font-size`를 지정하는 경우가 많아 `body`에만 설정하면 무시됨.
→ iframe `<head>`에 `<style id="sm-injected-style">` 태그를 직접 주입하여 `!important`로 덮어씀.

```javascript
const style = c.document.createElement('style')
style.id = 'sm-injected-style'
style.textContent = `
  body, p, div, span, li, a, blockquote,
  h1, h2, h3, h4, h5, h6 {
    font-size: ${settings.fontSize}px !important;
  }
  body {
    line-height: ${settings.lineHeight} !important;
    color: ${textColor} !important;
    background-color: ${bgColor} !important;
  }
`
c.document.head.appendChild(style)
```

---

### 모바일 대응 (Phase 5 이후 추가)

**수정 내용**
- Ask AI 버튼 위치 변경: 선택 위치 동적 계산 → **툴바 바로 아래 우측 고정**
  → 모바일 텍스트 선택 컨텍스트 메뉴(복사/공유/검색 바)에 가려지는 문제 해결

```css
.ask-ai-btn {
  position: fixed;
  top: calc(var(--toolbar-height) + 8px);
  right: 16px;
}
```

---

## 미해결 이슈

### 모바일 드래그 중 페이지 이동 문제

**현상**: 모바일에서 텍스트 선택을 위해 드래그하면 페이지가 옆으로 이동하여 두 페이지가 동시에 보이는 중간 상태가 됨.

**원인 분석**:
epub.js의 페이지 넘김 방식은 CSS scroll-snap 기반. `.epub-container`가 `overflow-x: scroll`인 컨테이너 위에 페이지들을 가로 배열하는 구조. 모바일 브라우저의 **scroll chaining** 동작으로 인해 iframe 내부에서 시작된 터치 드래그가 부모 컨테이너의 가로 스크롤로 전파됨.

데스크탑에서는 마우스 드래그 = 텍스트 선택으로만 인식되어 문제없음.

**시도한 방법 (모두 미해결)**:
1. `snap: false` 옵션 + `r.manager.snapper.destroy()` — epub.js snapper API가 이 구조에서 미동작
2. outer container에 capture-phase `touchmove/touchend` stopImmediatePropagation — epub.js 핸들러가 JS 이벤트 기반이 아니어서 무효
3. `.epub-container`에 `touch-action: pan-y` + `overscroll-behavior-x: none` CSS 직접 설정 — 스타일이 적용되나 효과 없음
4. epub iframe 내부 `<style>` 주입으로 `touch-action: pan-y` — 터치 시작 지점 기준으로 작동해야 하나 여전히 전파됨

**현재 상태**: 코드 원복 완료 (추가/변경 없음). 추후 해결 예정.

**향후 시도 방향**:
- epub.js GitHub Issues에서 동일 문제 검색
- `pointer-events: none` 오버레이로 드래그 방지 후 tap 이벤트만 허용하는 방식
- epub.js `flow: 'scrolled-doc'` 모드로 전환 (세로 스크롤 방식)

---

## 시스템 프롬프트 구조

`src/utils/systemPrompt.js`에 정의. 3단계 응답 구조:

| 단계 | 내용 |
|------|------|
| 📖 1단계: 직독직해 | 영어 어순 그대로 청크별 한국어 의미 |
| 📝 2단계: 자연스러운 해석 | 한국어로 자연스럽게 재구성 (1~2문장) |
| 💡 3단계: 영어식 사고방식 | 핵심 이미지, 어원, 문법, 문화적 맥락 등 (해당 항목만 선택) |

유저 메시지 구조:
```
[앞 문장] ...
[선택 문장] ...
[뒤 문장] ...

위의 [선택 문장]을 설명해주세요.
```

---

## 주요 기술 포인트 요약

| 문제 | 해결책 |
|------|--------|
| epub iframe 좌표 변환 | `iframe.getBoundingClientRect()` offset 더하기 |
| SSE 부분 JSON 청크 | buffer accumulation 패턴 (마지막 불완전 라인 보관) |
| epub 자체 CSS font-size 무시 | iframe `<head>`에 `<style>` 태그 직접 주입 + `!important` |
| 텍스트 선택 시 바텀시트 선택문장 사라짐 | `sheetSelectedText` 별도 state로 고정 |
| 외부 클릭 시 Ask AI 버튼 미사라짐 | `window.mousedown` + `rendition.on('click')` 조합 |
| CSS 높이 애니메이션 (내용 높이 미지정) | `grid-template-rows: 0fr → 1fr` 트릭 |
| 모바일 Ask AI 버튼 컨텍스트 메뉴에 가려짐 | 툴바 아래 우측 고정 위치로 변경 |
