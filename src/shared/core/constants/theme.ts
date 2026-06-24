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
    surfaceAlt: '#222634', // surface 위에 한 단계 더 떠 보이는 패널/입력 배경
    codeBg: '#0b0d13', // 코드 에디터/코드블록 배경 (가장 어두운 톤)
    border: '#2a2e3a',
    text: '#e6e8ee',
    textMuted: '#9aa0ac',
    primary: '#5b8cff',
    primaryHover: '#7aa1ff',
    info: '#5bc0ff', // 보조 정보 강조(토큰/메타)
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
