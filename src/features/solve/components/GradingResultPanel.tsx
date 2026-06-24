/**
 * GradingResultPanel.tsx — 채점 결과 패널
 *
 * 제출/예제 실행 결과를 보여준다: 통과 수 요약, 모의 채점 여부 배너, 케이스별
 * 상태와 (공개 케이스는) 입력/기대/실제 출력. 표시 전용으로 result/상태만 받는다.
 *
 * 사용처: features/solve/SolveView
 */
'use client';

import styled from 'styled-components';
import type { GradingResult, TestCaseResult, TestCaseStatus } from '@/shared/core/types';
import type { BadgeTone } from '@/shared/components/ui/Badge';
import { Badge } from '@/shared/components/ui/Badge';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TestCaseStatus, string> = {
  passed: '통과',
  failed: '실패',
  timeout: '시간 초과',
  error: '오류',
};

const STATUS_TONE: Record<TestCaseStatus, BadgeTone> = {
  passed: 'success',
  failed: 'danger',
  timeout: 'warning',
  error: 'danger',
};

// ── Types ─────────────────────────────────────────────────────────────────

interface GradingResultPanelProps {
  result: GradingResult | null;
  isGrading: boolean;
  errorMessage: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export function GradingResultPanel({
  result,
  isGrading,
  errorMessage,
}: GradingResultPanelProps) {
  if (isGrading) {
    return <Placeholder>채점 중…</Placeholder>;
  }
  if (errorMessage) {
    return <ErrorBox>채점 실패: {errorMessage}</ErrorBox>;
  }
  if (!result) {
    return <Placeholder>제출하면 채점 결과가 여기에 표시됩니다.</Placeholder>;
  }

  const allPassed = result.passedCount === result.totalCount && result.totalCount > 0;

  return (
    <Wrapper>
      <Summary>
        <Badge tone={allPassed ? 'success' : 'danger'}>
          {result.passedCount} / {result.totalCount} 통과
        </Badge>
        {result.isMock && (
          <Badge tone="warning">모의 채점 (실제 실행 아님)</Badge>
        )}
      </Summary>

      <CaseList>
        {result.caseResults.map((caseResult, index) => (
          <CaseRow key={caseResult.testCaseId}>
            <CaseHeader>
              <CaseName>
                케이스 #{index + 1}
                {!caseResult.isPublic && <Hidden> (비공개)</Hidden>}
              </CaseName>
              <Badge tone={STATUS_TONE[caseResult.status]}>
                {STATUS_LABEL[caseResult.status]}
              </Badge>
            </CaseHeader>
            {caseResult.isPublic && <CaseDetail result={caseResult} />}
          </CaseRow>
        ))}
      </CaseList>
    </Wrapper>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function CaseDetail({ result }: { result: TestCaseResult }) {
  return (
    <DetailGrid>
      <DetailCol>
        <DetailLabel>입력</DetailLabel>
        <Pre>{result.input ?? ''}</Pre>
      </DetailCol>
      <DetailCol>
        <DetailLabel>기대 출력</DetailLabel>
        <Pre>{result.expectedOutput ?? ''}</Pre>
      </DetailCol>
      <DetailCol>
        <DetailLabel>실제 출력</DetailLabel>
        <Pre>{result.actualOutput ?? ''}</Pre>
      </DetailCol>
      {result.stderr && (
        <DetailCol $span>
          <DetailLabel>에러</DetailLabel>
          <Pre $error>{result.stderr}</Pre>
        </DetailCol>
      )}
    </DetailGrid>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Placeholder = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ErrorBox = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
`;

const Summary = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CaseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CaseRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const CaseHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CaseName = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
`;

const Hidden = styled.span`
  font-weight: ${({ theme }) => theme.font.weightRegular};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const DetailCol = styled.div<{ $span?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  grid-column: ${({ $span }) => ($span ? '1 / -1' : 'auto')};
`;

const DetailLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Pre = styled.pre<{ $error?: boolean }>`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colors.codeBg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.text)};
  white-space: pre-wrap;
  word-break: break-word;
`;
