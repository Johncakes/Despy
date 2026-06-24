/**
 * GlobalStyle.tsx — 전역 스타일 (styled-components createGlobalStyle)
 *
 * reset 성격의 기본 스타일과 테마 기반 body 배경/글자색을 정의한다.
 * 색상은 하드코딩하지 않고 테마 토큰을 사용한다.
 *
 * 사용처: AppProviders (ThemeProvider 내부)
 */
'use client';

import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  body {
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: ${({ theme }) => theme.font.sizeMd};
    -webkit-font-smoothing: antialiased;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`;
