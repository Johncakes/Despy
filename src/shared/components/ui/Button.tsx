/**
 * Button.tsx — 기본 버튼 UI 컴포넌트 (스타터 예시)
 *
 * 컨벤션을 보여주는 기본 UI 컴포넌트: 테마 토큰만 사용하고, DOM에 누수되면
 * 안 되는 prop은 transient($) 접두사를 붙인다. shared 컴포넌트는 feature를
 * import하지 않고 props로 의존성을 주입받는다(DI).
 *
 * 사용처: features/*, app/* 의 버튼 UI
 */
'use client';

import styled, { css } from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 시각적 강조 수준 */
  variant?: ButtonVariant;
}

// ── Component ─────────────────────────────────────────────────────────
export function Button({ variant = 'primary', children, ...rest }: ButtonProps) {
  return (
    <StyledButton $variant={variant} {...rest}>
      {children}
    </StyledButton>
  );
}

// ── Styled Components ─────────────────────────────────────────────────
const StyledButton = styled.button<{ $variant: ButtonVariant }>`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;

  ${({ theme, $variant }) =>
    $variant === 'primary'
      ? css`
          background: ${theme.colors.primary};
          color: #ffffff;
          border: 1px solid ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primaryHover};
            border-color: ${theme.colors.primaryHover};
          }
        `
      : css`
          background: transparent;
          color: ${theme.colors.text};
          border: 1px solid ${theme.colors.border};
          &:hover {
            background: ${theme.colors.surfaceAlt};
          }
        `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
