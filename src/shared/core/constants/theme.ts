/**
 * theme.ts — 디자인 토큰 (styled-components 테마)
 *
 * 색상·간격·타이포 등 모든 시각 토큰의 단일 출처. 컴포넌트는 색상/간격을
 * 하드코딩하지 않고 반드시 이 테마를 통해 참조한다 (하드코딩 색상 금지).
 *
 * 사용처: ThemeProvider, 모든 styled-components, styled.d.ts 타입 증강
 */

export const theme = {
  colors: {
    background: '#0f1117',
    surface: '#1a1d27',
    border: '#2a2e3a',
    text: '#e6e8ee',
    textMuted: '#9aa0ac',
    primary: '#5b8cff',
    primaryHover: '#7aa1ff',
    success: '#3ecf8e',
    danger: '#ff5b6e',
    warning: '#ffcf5b',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '16px',
  },
  font: {
    sizeSm: '13px',
    sizeMd: '15px',
    sizeLg: '20px',
    weightRegular: 400,
    weightBold: 600,
  },
} as const;

export type AppTheme = typeof theme;
