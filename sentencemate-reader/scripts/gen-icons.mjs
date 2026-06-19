// PWA placeholder 아이콘 생성기 (M8 PWA). Node 내장 zlib만 사용 — 외부 의존성 없음.
// teal(#2c6f61) 배경 + 중앙 크림(#fcfaf6) 원 마크의 단색 PNG를 public/에 출력한다.
// ※ placeholder다. 실제 브랜드 로고가 생기면 같은 파일명으로 교체하면 된다.
//    재생성: `node scripts/gen-icons.mjs`
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [0x2c, 0x6f, 0x61] // teal --accent
const FG = [0xfc, 0xfa, 0xf6] // cream --bg-primary

// CRC32 (PNG 청크용) — 테이블 없이 비트 연산.
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

// size×size RGBA 래스터를 그려 PNG Buffer 반환. mark=true면 중앙 원.
function makePNG(size, markRadiusFactor) {
  const cx = size / 2
  const cy = size / 2
  const r = size * markRadiusFactor
  const r2 = r * r

  // raw = 각 스캔라인 앞에 filter 바이트(0) + RGBA
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const inside = markRadiusFactor > 0 && dx * dx + dy * dy <= r2
      const [r0, g0, b0] = inside ? FG : BG
      const off = y * stride + 1 + x * 4
      raw[off] = r0
      raw[off + 1] = g0
      raw[off + 2] = b0
      raw[off + 3] = 0xff
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const idat = deflateSync(raw)
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = new URL('../public/', import.meta.url)
mkdirSync(outDir, { recursive: true })

const files = [
  ['pwa-192x192.png', 192, 0.28],
  ['pwa-512x512.png', 512, 0.28],
  // maskable: 마스크 안전영역(중앙 80%) 안에 들도록 마크를 더 작게.
  ['pwa-maskable-512x512.png', 512, 0.22],
  ['apple-touch-icon-180x180.png', 180, 0.28],
]

for (const [name, size, mark] of files) {
  const png = makePNG(size, mark)
  writeFileSync(new URL(name, outDir), png)
  console.log(`✓ public/${name} (${size}px, ${png.length} bytes)`)
}
console.log('완료 — placeholder 아이콘. 실제 로고로 교체 시 같은 파일명 사용.')
