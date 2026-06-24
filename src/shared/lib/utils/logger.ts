/**
 * logger.ts — 경량 로깅 유틸
 *
 * console.log 직접 호출을 금지하는 대신 사용하는 래퍼. 개발 환경에서만
 * debug/info를 출력하고, warn/error는 항상 출력한다. 추후 외부 로깅
 * 서비스 연동 시 이 한 곳만 수정하면 된다.
 *
 * 사용처: 프로젝트 전역 (console.log 대체)
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.warn('[debug]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.warn('[info]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[warn]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[error]', ...args);
  },
};
