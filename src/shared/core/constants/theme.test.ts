/**
 * theme.test.ts — 테마 토큰 sanity 테스트
 *
 * 초기 세팅 검증용 최소 테스트. vitest 파이프라인이 동작하는지와 테마 토큰의
 * 기본 구조가 유지되는지 확인한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('필수 색상 토큰을 제공한다', () => {
    expect(theme.colors.primary).toBeTypeOf('string');
    expect(theme.colors.background).toBeTypeOf('string');
    expect(theme.colors.text).toBeTypeOf('string');
  });

  it('간격 토큰 스케일을 제공한다', () => {
    expect(Object.keys(theme.spacing)).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });
});
