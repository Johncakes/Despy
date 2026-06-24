/**
 * AppThemeProvider.tsx — styled-components 테마 주입 + 전역 스타일
 *
 * theme.ts의 디자인 토큰을 styled-components ThemeProvider로 트리에 주입하고
 * GlobalStyle을 함께 적용한다.
 *
 * 사용처: AppProviders
 */
'use client';

import { ThemeProvider } from 'styled-components';
import { theme } from '@/shared/core/constants/theme';
import { GlobalStyle } from '@/shared/components/providers/GlobalStyle';

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
}
