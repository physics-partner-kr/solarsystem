import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 빌드 결과는 사진·코드가 모두 들어 있는 HTML 파일 하나(dist/index.html)
// - 상대 경로(base: './')라서 GitHub Pages의 어느 주소에 올려도 동작
// - 인터넷이 없는 교실에서도 파일을 더블클릭해 열 수 있음
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8000,
    cssCodeSplit: false,
  },
});
