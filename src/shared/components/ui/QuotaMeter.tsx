/**
 * QuotaMeter.tsx — 사용량/한도 게이지
 *
 * "남은 질문 횟수", "남은 토큰" 같은 한도를 막대 게이지 + 수치로 보여준다.
 * 한도에 가까워지면 색이 경고/위험으로 바뀐다. 값만 props로 받는 순수 UI.
 *
 * 사용처: features/solve(AI 채팅 패널의 한도 표시)
 */
'use client';

import styled from 'styled-components';

// ── Constants ──────────────────────────────────────────────────────────────

const WARNING_RATIO = 0.7; // 사용률 70% 이상 → 경고색
const DANGER_RATIO = 0.9; // 사용률 90% 이상 → 위험색

// ── Types ─────────────────────────────────────────────────────────────────

interface QuotaMeterProps {
  label: string;
  used: number;
  max: number;
  /** 수치 뒤 단위 표기 (예: '토큰') */
  unit?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function QuotaMeter({ label, used, max, unit }: QuotaMeterProps) {
  const ratio = max > 0 ? Math.min(used / max, 1) : 0;
  const remaining = Math.max(max - used, 0);
  const tone = ratio >= DANGER_RATIO ? 'danger' : ratio >= WARNING_RATIO ? 'warning' : 'ok';

  return (
    <Wrapper>
      <Row>
        <Label>{label}</Label>
        <Value>
          남은 {remaining.toLocaleString()}
          {unit ? ` ${unit}` : ''} / {max.toLocaleString()}
        </Value>
      </Row>
      <Track>
        <Fill $ratio={ratio} $tone={tone} />
      </Track>
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Row = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Label = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Value = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
`;

const Track = styled.div`
  height: 6px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  overflow: hidden;
`;

const Fill = styled.div<{ $ratio: number; $tone: 'ok' | 'warning' | 'danger' }>`
  height: 100%;
  width: ${({ $ratio }) => `${$ratio * 100}%`};
  transition: width 0.2s ease;
  background: ${({ theme, $tone }) =>
    $tone === 'danger'
      ? theme.colors.danger
      : $tone === 'warning'
        ? theme.colors.warning
        : theme.colors.success};
`;
