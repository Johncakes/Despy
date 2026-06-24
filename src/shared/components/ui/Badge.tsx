/**
 * Badge.tsx — 상태/레이블 배지
 *
 * 채점 케이스 상태(통과/실패/오류), 모의 채점 표시, 메타 정보 등을 작은
 * 색상 배지로 보여준다. tone으로 색을 결정하며 테마 토큰만 사용한다.
 *
 * 사용처: features/solve(채점 결과), 공용 상태 표시
 */
'use client';

import styled, { css } from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <Pill $tone={tone}>{children}</Pill>;
}

// ── Styled Components ─────────────────────────────────────────────────────

const Pill = styled.span<{ $tone: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  white-space: nowrap;

  ${({ theme, $tone }) => {
    const map = {
      neutral: theme.colors.textMuted,
      success: theme.colors.success,
      danger: theme.colors.danger,
      warning: theme.colors.warning,
      info: theme.colors.info,
    } as const;
    const color = map[$tone];
    return css`
      color: ${color};
      background: ${color}22;
      border: 1px solid ${color}55;
    `;
  }}
`;
