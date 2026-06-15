// 표지 = 타이포그래피 폴백 (frontend_plan §6.1). epub 실제 표지 이미지 렌더는 다음 범위.
// 상단 악센트선 + 세리프 제목 + 저자, hairline 표면. size: 'lg'(계속읽기) | 'grid'(그리드 기본).
export default function BookCover({ title, author, size = 'grid' }) {
  return (
    <div className={`book-cover book-cover--${size}`}>
      <span className="book-cover__accent" aria-hidden="true" />
      <span className="book-cover__title">{title}</span>
      {author ? <span className="book-cover__author">{author}</span> : null}
    </div>
  )
}
