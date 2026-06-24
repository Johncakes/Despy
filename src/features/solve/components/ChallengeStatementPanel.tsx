/**
 * ChallengeStatementPanel.tsx — 과제 지문 패널 (WebContainer 피벗)
 *
 * 실무형 웹 과제(ChallengeProblem)의 제목·마크다운 지문(요구사항·계약)을 보여준다.
 * 알고리즘 문제의 입출력 형식·예제(구 ProblemPanel)와 달리, 과제는 마크다운 지문이
 * 단일 출처라 그대로 렌더한다. 표시 전용으로 title·statement만 받는다(제어 컴포넌트).
 *
 * 사용처: features/solve/ChallengeSolveView
 */
'use client';

import styled from 'styled-components';
import { Panel } from '@/shared/components/ui/Panel';
import { Markdown } from '@/shared/components/ui/Markdown';
import { Button } from '@/shared/components/ui/Button';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChallengeStatementPanelProps {
  title: string;
  /** 마크다운 지문 (요구사항·계약) */
  statement: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeStatementPanel({
  title,
  statement,
  isOpen = true,
  onToggle,
}: ChallengeStatementPanelProps) {
  if (!isOpen && onToggle) {
    return (
      <CollapsedBar type="button" onClick={onToggle} aria-label="요구사항 열기">
        <CollapsedText>요구사항</CollapsedText>
      </CollapsedBar>
    );
  }

  return (
    <Panel 
      title="요구사항" 
      actions={onToggle && <Button variant="ghost" onClick={onToggle}>닫기</Button>}
      className="full-height"
    >
      <Markdown>{statement}</Markdown>
    </Panel>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const CollapsedBar = styled.button`
  width: 44px;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

const CollapsedText = styled.span`
  writing-mode: vertical-rl;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  letter-spacing: 2px;
`;
