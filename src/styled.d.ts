/**
 * styled.d.ts — styled-components DefaultTheme 타입 증강
 *
 * theme.ts의 AppTheme을 styled-components의 DefaultTheme에 연결해
 * `theme.colors.text` 같은 접근이 전역에서 타입 안전하도록 한다.
 *
 * 사용처: 모든 styled-components의 ${({ theme }) => ...} 콜백
 */
import 'styled-components';
import type { AppTheme } from '@/shared/core/constants/theme';

declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}
