/**
 * layout.tsx — 루트 레이아웃 (App Router 진입점)
 *
 * 모든 페이지를 감싸는 최상위 레이아웃. 전역 프로바이더(AppProviders)를
 * 여기서 한 번만 주입한다. 라우팅/레이아웃 외 도메인 로직은 두지 않는다.
 *
 * 사용처: Next.js App Router 루트
 */
import type { Metadata } from 'next';
import { AppProviders } from '@/shared/components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'despy — 에이전틱 코딩 평가 시스템',
  description: 'AI 에이전트를 통제된 범위에서 활용해 알고리즘 문제를 푸는 능력을 평가합니다.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
