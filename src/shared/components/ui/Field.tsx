/**
 * Field.tsx — 폼 입력 프리미티브 (라벨/입력/선택)
 *
 * 교수 출제 폼 등에서 재사용하는 라벨 래퍼와 테마가 적용된 입력 요소들을
 * 제공한다. Field는 라벨+힌트+자식(입력)을 묶고, TextInput/TextArea/Select는
 * 스타일된 네이티브 요소다. 순수 UI(피처 비의존).
 *
 * 사용처: features/author(문제/정책 폼)
 */
'use client';

import styled from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

interface FieldProps {
  label: React.ReactNode;
  /** 입력 아래 보조 설명 */
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  return (
    <Wrapper>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint !== undefined && <Hint>{hint}</Hint>}
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const Hint = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const inputStyles = `
  width: 100%;
  font-size: 15px;
  border-radius: 8px;
`;

export const TextInput = styled.input`
  ${inputStyles}
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

export const TextArea = styled.textarea`
  ${inputStyles}
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-family: ${({ theme }) => theme.font.mono};
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

export const Select = styled.select`
  ${inputStyles}
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;
