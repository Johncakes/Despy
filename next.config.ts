/**
 * next.config.ts — Next.js 설정
 *
 * styled-components SSR을 위해 컴파일러 옵션을 활성화한다.
 * (서버에서 생성한 스타일을 클라이언트와 일치시키기 위함)
 *
 * 사용처: Next.js 빌드/런타임 전역 설정
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;
