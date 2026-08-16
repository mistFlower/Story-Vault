import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri는 고정 포트를 기대한다. 포트가 사용 중이면 죽게 두어야 조용히 어긋나지 않는다.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust 빌드 산출물과 원고 디렉터리는 HMR 대상이 아니다.
      ignored: ['**/src-tauri/**', '**/vault/**', '**/tauri_src/**'],
    },
  },
  // Tauri는 자체적으로 최신 웹뷰를 쓰므로 다운레벨링이 필요 없다.
  build: {
    target: 'chrome105',
    minify: 'esbuild',
    sourcemap: false,
  },
})
