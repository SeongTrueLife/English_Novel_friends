# 버그 분석: 텍스트 선택 시 페이지 스크롤 오프셋 어긋남 현상

## 1. 현상 요약

- **환경:** 태블릿/모바일에서 롱탭으로 텍스트를 선택(블록 지정)할 때
- **증상:** 선택 드래그 중 화면이 휙 이동하면서 **1페이지와 2페이지 사이**에 걸친 상태가 됨
- **특히 심한 경우:** 페이지 맨 윗줄 문장에서 시작할 때
- **지속성:** 이 상태에서 다음/이전 페이지 버튼을 눌러도 오프셋이 리셋되지 않고, 계속 반 페이지씩 밀린 채로 넘어감

---

## 2. epub.js paginated 모드의 페이지 렌더링 구조

```
[reader-body (div, overflow: hidden)]
  └─ [epub-viewer (div)]
       └─ [stage container (div)] ← 이것의 scrollLeft로 페이지 전환
            └─ [iframe (scrolling="no", overflow: hidden)]
                 └─ [document body]  ← CSS column-width로 페이지 분할
```

### 핵심 메커니즘

1. **CSS Columns로 페이지 분할:** iframe 내부 콘텐츠는 `column-width`, `column-gap` CSS를 사용해 가로로 여러 컬럼(=페이지)으로 나뉨
   - 파일: `epubjs/lib/contents.js` (columns 메서드)
   - `column-axis: horizontal`, `overflow-y: hidden` 설정

2. **container의 scrollLeft로 페이지 이동:** epub.js는 stage container의 `scrollLeft` 값을 `layout.delta`(한 페이지 너비) 단위로 증감시켜 페이지를 전환함
   - `next()` → `scrollBy(+layout.delta, 0)`
   - `prev()` → `scrollBy(-layout.delta, 0)`
   - 파일: `epubjs/lib/managers/default/index.js`

3. **iframe 자체는 스크롤 불가:** `scrolling="no"`, `overflow: hidden`, `position: absolute` 설정
   - 파일: `epubjs/lib/managers/views/iframe.js`

---

## 3. 버그 원인 분석

### 3-1. 직접적 원인: 브라우저의 네이티브 선택 시 자동 스크롤

텍스트를 롱탭 후 드래그로 선택을 확장할 때, **브라우저는 선택 영역이 화면에 보이도록 자동으로 스크롤**시킵니다. 이것은 브라우저의 기본 동작입니다.

문제는 epub.js의 paginated 모드에서:
- container의 `scrollLeft`는 반드시 `layout.delta`의 정수 배수여야 페이지가 정렬됨
  - 예: delta=430px이면 → 0, 430, 860, 1290... 만 유효
- 그러나 브라우저의 자동 스크롤은 **임의의 픽셀 값**으로 scrollLeft를 변경함
  - 예: 0px → 215px (반 페이지만큼 밀림)
- 결과: **두 페이지 사이에 걸친 상태**가 됨

### 3-2. 페이지 맨 윗줄에서 특히 심한 이유

맨 윗줄에서 아래쪽으로 드래그하면:
- 선택 영역이 현재 컬럼(페이지)의 끝을 넘어 **다음 컬럼(다음 페이지)**까지 확장됨
- 브라우저가 다음 컬럼의 선택된 부분이 보이도록 container를 가로 스크롤함
- CSS column 레이아웃에서 맨 위에서 시작하면 드래그 거리가 짧아도 컬럼 경계를 쉽게 넘음

### 3-3. 오프셋이 리셋되지 않는 이유

epub.js의 `next()`/`prev()` 동작 (`managers/default/index.js`):

```javascript
// next() - 현재 scrollLeft에 delta를 더함
this.scrollLeft = this.container.scrollLeft;  // 현재 위치 저장
this.scrollBy(this.layout.delta, 0, true);    // delta만큼 추가 스크롤
```

문제:
- `scrollBy`는 **현재 scrollLeft에 상대적으로 delta를 더하는** 방식
- 이미 215px 밀린 상태에서 delta(430)를 더하면 → 645px (여전히 정렬 안 됨)
- 올바른 값은 430px이어야 하지만 645px이 됨 → 영구적으로 반 페이지 밀림

`relocated` 이벤트도 스크롤 위치를 교정하지 않음:
- 단순히 현재 위치 정보를 emit할 뿐, scrollLeft를 리셋하는 코드 없음

### 3-4. Snap(스냅) 기능의 부재

epub.js에는 터치 스크롤 시 페이지 경계에 스냅하는 `Snap` 클래스가 있지만:
- **continuous(연속 스크롤) 모드에서만 활성화**됨
- paginated 모드에서는 Snap이 적용되지 않음
- 따라서 외부 요인(텍스트 선택)으로 scrollLeft가 어긋나면 교정 메커니즘이 없음

---

## 4. 관련 코드 위치

### 앱 코드 (sentencemate-reader)

| 파일 | 라인 | 내용 |
|------|------|------|
| `EpubReader.jsx` | 40-45 | epub.js 초기화 (paginated, spread:none) |
| `EpubReader.jsx` | 54-60 | `relocated` 이벤트 핸들러 (clearSelection만 호출, 스크롤 교정 없음) |
| `EpubReader.jsx` | 118-119 | `handlePrev`/`handleNext` (단순히 prev/next 호출) |
| `EpubReader.jsx` | 128-133 | `handleAskAI` 내 `scrollIntoView` 호출 (별도의 추가 문제 가능성) |
| `useTextSelection.js` | 34-81 | `handleSelected` - 선택 감지 시 스크롤 관련 방어 코드 없음 |

### epub.js 라이브러리 내부

| 파일 | 내용 |
|------|------|
| `lib/managers/default/index.js:418-426` | `next()` - scrollBy(+delta) 방식으로 작동 |
| `lib/managers/default/index.js:491-500` | `prev()` - scrollBy(-delta) 방식으로 작동 |
| `lib/managers/default/index.js:800-801` | `scrollTo(x,y)` - container.scrollLeft 직접 설정 |
| `lib/contents.js:955-1016` | 텍스트 선택 이벤트 리스너 (스크롤 방어 없음) |
| `lib/contents.js:1095-1145` | CSS column 설정 (paginated 레이아웃) |
| `lib/managers/views/iframe.js:79-96` | iframe 스크롤 비활성화 설정 |

---

## 5. 문제 흐름 정리

```
1. 사용자가 페이지 맨 윗줄을 롱탭
2. 드래그로 선택 영역을 아래로 확장
3. 선택이 CSS column 경계(=페이지 경계)를 넘어감
4. 브라우저가 네이티브 동작으로 container.scrollLeft를 변경
   (delta의 정수 배가 아닌 임의 값으로)
5. 화면이 두 페이지 사이에 걸쳐 보임
6. 사용자가 선택을 해제하거나 페이지를 넘겨도:
   - relocated 이벤트: scrollLeft 교정 안 함
   - next()/prev(): 현재 어긋난 scrollLeft에 delta를 더하므로 계속 어긋남
7. 영구적으로 반 페이지 밀린 상태 지속
```

---

## 6. handleAskAI의 scrollIntoView (추가 문제)

`EpubReader.jsx:128-133`에도 관련 위험 요소가 있음:

```javascript
const sheetTop = window.innerHeight * 0.55
if (selectionRect && selectionRect.bottom > sheetTop) {
  selectedElementRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
```

- `scrollIntoView`는 iframe 내부 요소에 대해 호출됨
- paginated 모드에서 이것이 container의 scrollLeft를 변경할 수 있음
- Ask AI 버튼을 누르는 시점에도 동일한 스크롤 오프셋 어긋남이 발생할 수 있음
- 주석에 "paginated 모드에서는 무시"라고 적혀 있지만, try-catch로 감싸져 있을 뿐 실제로 paginated 모드를 감지해서 건너뛰는 로직은 없음

---

## 7. 수정 시 고려할 접근 방향 (참고용)

1. **텍스트 선택 중/후 scrollLeft 정렬:** container의 scrollLeft를 가장 가까운 `delta` 배수로 스냅
2. **relocated 이벤트에서 스크롤 교정:** 페이지 전환 시 scrollLeft를 강제 정렬
3. **scrollIntoView 제거/조건부 실행:** paginated 모드에서는 호출하지 않도록 수정
4. **CSS scroll-snap 활용:** container에 `scroll-snap-type: x mandatory` 적용 검토
