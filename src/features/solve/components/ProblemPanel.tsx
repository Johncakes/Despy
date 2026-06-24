/**
 * ProblemPanel.tsx — 문제 지문 패널 (학생용)
 *
 * 문제 제목·제한(시간/메모리)·지문(마크다운)·입출력 형식·공개 예제를 보여준다.
 * 비공개 테스트 케이스는 노출하지 않는다. 표시 전용으로 problem만 받는다.
 *
 * 사용처: features/solve/SolveView
 */
'use client';

import styled from 'styled-components';
import type { Problem } from '@/shared/core/types';
import { Panel } from '@/shared/components/ui/Panel';
import { Badge } from '@/shared/components/ui/Badge';
import { Markdown } from '@/shared/components/ui/Markdown';

// ── Component ─────────────────────────────────────────────────────────────

export function ProblemPanel({ problem }: { problem: Problem }) {
  const publicCases = problem.testCases.filter((testCase) => testCase.isPublic);

  return (
    <Panel title={problem.title}>
      <Meta>
        <Badge tone="info">시간 제한 {problem.timeLimitSec}s</Badge>
        <Badge tone="info">메모리 제한 {problem.memoryLimitMb}MB</Badge>
      </Meta>

      <Markdown>{problem.statement}</Markdown>

      {problem.inputFormat.trim() && (
        <>
          <SubTitle>입력 형식</SubTitle>
          <Markdown>{problem.inputFormat}</Markdown>
        </>
      )}

      {problem.outputFormat.trim() && (
        <>
          <SubTitle>출력 형식</SubTitle>
          <Markdown>{problem.outputFormat}</Markdown>
        </>
      )}

      {publicCases.length > 0 && (
        <>
          <SubTitle>예제</SubTitle>
          {publicCases.map((testCase, index) => (
            <Example key={testCase.id}>
              <ExampleCol>
                <ColLabel>입력 {index + 1}</ColLabel>
                <Pre>{testCase.input}</Pre>
              </ExampleCol>
              <ExampleCol>
                <ColLabel>출력 {index + 1}</ColLabel>
                <Pre>{testCase.expectedOutput}</Pre>
              </ExampleCol>
            </Example>
          ))}
        </>
      )}
    </Panel>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Meta = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const SubTitle = styled.h3`
  margin: ${({ theme }) => `${theme.spacing.md} 0 ${theme.spacing.xs}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
`;

const Example = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const ExampleCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ColLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Pre = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  white-space: pre-wrap;
  word-break: break-word;
`;
