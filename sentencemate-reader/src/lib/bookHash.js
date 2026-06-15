// epub 파일(File/Blob)의 SHA-256 해시를 hex 문자열로.
// 같은 책 자동매칭(book_hash)용 — backend_design ③ upsertBookByHash가 이 값을 받는다.
// 순수 함수: React/Supabase 무관, Web Crypto만 사용.

export async function hashEpub(file) {
  const buffer = await file.arrayBuffer() // File/Blob → ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return bufferToHex(digest)
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('') // 64자 소문자 hex
}
