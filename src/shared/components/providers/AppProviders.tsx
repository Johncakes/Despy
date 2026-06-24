/**
 * AppProviders.tsx — 전역 프로바이더 조합
 *
 * 앱 전체에 필요한 클라이언트 프로바이더(스타일 레지스트리 → 테마 → Query)를
 * 한 곳에서 합성한다. 루트 레이아웃은 이 컴포넌트 하나만 감싸면 된다.
 *
 * 사용처: app/layout.tsx
 */
'use client';

import { StyledComponentsRegistry } from '@/shared/components/providers/StyledComponentsRegistry';
import { AppThemeProvider } from '@/shared/components/providers/AppThemeProvider';
import { AppQueryProvider } from '@/shared/components/providers/AppQueryProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <AppThemeProvider>
        <AppQueryProvider>{children}</AppQueryProvider>
      </AppThemeProvider>
    </StyledComponentsRegistry>
  );
}
