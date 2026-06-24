/**
 * next.config.ts — Next.js 설정
 *
 * styled-components SSR을 위해 컴파일러 옵션을 활성화하고, WebContainer 구동에
 * 필수인 cross-origin isolation 헤더(COOP/COEP)를 모든 응답에 주입한다.
 *
 * WebContainer는 SharedArrayBuffer를 사용하므로 페이지가 cross-origin isolated
 * 상태여야 한다. 두 헤더가 없으면 WebContainer.boot() 자체가 실패한다.
 * (docs/spec-webcontainer.md §2.1)
 *   - Cross-Origin-Opener-Policy: same-origin
 *   - Cross-Origin-Embedder-Policy: require-corp
 *     → 외부 리소스는 CORP/CORS를 만족해야 로드된다. 현재 앱이 쓰는 외부 리소스는
 *       Monaco의 jsdelivr CDN뿐이며, jsdelivr는 CORP(cross-origin)+CORS를 보내므로
 *       require-corp에서도 정상 로드된다(점검 완료). 새 외부 CDN/폰트 도입 시 재점검.
 *
 * 사용처: Next.js 빌드/런타임 전역 설정
 */
import type { NextConfig } from 'next';

/** WebContainer(cross-origin isolation)에 필요한 전역 헤더 */
const CROSS_ORIGIN_ISOLATION_HEADERS = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  async headers() {
    return [
      {
        // 모든 경로(페이지·정적 자산 포함)에 cross-origin isolation 헤더 적용
        source: '/:path*',
        headers: CROSS_ORIGIN_ISOLATION_HEADERS,
      },
    ];
  },
};

export default nextConfig;
