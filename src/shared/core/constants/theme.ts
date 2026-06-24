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
    background: '#f3f4f6', // Soft light gray background like LeetCode layout background
    surface: '#ffffff', // Clean white panels/cards
    surfaceAlt: '#f9fafb', // Light gray for panel headers, lists, tabs, and console panels
    codeBg: '#f7f9fa', // Background color for code blocks and read-only editors
    border: '#e5e7eb', // Crisp light border color
    text: '#1f2937', // Dark gray for body text, providing high contrast
    textMuted: '#6b7280', // Soft gray for meta/muted text
    primary: '#1d4ed8', // Premium desktop UI blue for primary highlights
    primaryHover: '#3b82f6', // Brighter blue hover state
    info: '#0284c7', // Desktop UI blue accent for logs and stats
    success: '#2cbb5d', // Signature LeetCode green for successful testcases
    danger: '#ef4743', // Signature LeetCode red for failures
    warning: '#f59e0b', // Amber for warnings/locks
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
    sizeXs: '11px',
    sizeSm: '13px',
    sizeMd: '15px',
    sizeLg: '20px',
    weightRegular: 400,
    weightBold: 600,
    mono: "'SFMono-Regular', 'JetBrains Mono', Consolas, 'Liberation Mono', Menlo, monospace",
  },
} as const;

export type AppTheme = typeof theme;
