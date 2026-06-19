import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA(M8): 설치(홈 화면 추가) + 오프라인 앱 셸. 정본: frontend_arch ④ / plan_v3 K.
    // 오프라인 범위는 "셸 precache까지"(MVP) — AI/DB는 온라인 필요라 런타임 캐시 생략.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'SentenceMate Reader',
        short_name: 'SentenceMate',
        description: '추론으로 읽는 영어 원서 리더',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#efe9e0', // 따뜻한 종이(§3 토큰)
        background_color: '#efe9e0', // 스플래시 배경
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html', // SPA 딥링크 오프라인 라우팅
      },
    }),
  ],
})
