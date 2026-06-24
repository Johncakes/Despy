/**
 * vitest.config.ts — Vitest 설정
 *
 * 핵심 로직 단위 테스트 환경. @/ alias를 src에 매핑하고 jsdom 환경에서
 * React 컴포넌트/훅 테스트가 가능하도록 plugin-react를 등록한다.
 *
 * 사용처: `npm run test`
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
