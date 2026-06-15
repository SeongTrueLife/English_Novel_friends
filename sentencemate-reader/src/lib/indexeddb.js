// 사용자 업로드 epub의 로컬 보관소 (backend_design ④: user_upload는 클라우드 X, 이 단말기 IndexedDB만).
// book_id를 키로 epub Blob 저장/조회. 순수 인프라 — React/Supabase 무관.
import { openDB } from 'idb'

const DB_NAME = 'sentencemate'
const DB_VERSION = 1
const STORE = 'epubs'

// idb DB 핸들 lazy 캐싱 (supabase.js bootPromise와 같은 패턴 — 중복 open 방지).
let dbPromise = null
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE) // out-of-line key: put(store, value, key)
        }
      },
    })
  }
  return dbPromise
}

export async function saveEpub(bookId, blob) {
  const db = await getDB()
  await db.put(STORE, blob, bookId)
}

export async function getEpub(bookId) {
  const db = await getDB()
  const blob = await db.get(STORE, bookId)
  return blob ?? null // 명시적으로 null (계약: Blob | null)
}

export async function hasEpub(bookId) {
  const db = await getDB()
  const key = await db.getKey(STORE, bookId)
  return key !== undefined // 값을 통째로 안 읽고 키 존재만 (대용량 Blob 회피)
}

export async function deleteEpub(bookId) {
  const db = await getDB()
  await db.delete(STORE, bookId)
}
