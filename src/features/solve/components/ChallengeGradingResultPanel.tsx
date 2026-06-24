/**
 * ChallengeGradingResultPanel.tsx — 과제 채점 결과 모달 (WebContainer 피벗 P3)
 *
 * /api/grade가 돌려준 ChallengeGradingResult(최종 점수·자동 테스트 요약·루브릭
 * 항목별 점수/근거·종합 피드백)를 화면 위 오버레이(모달)로 보여준다. 제출은 1회성
 * 이벤트라 모달로 집중도를 주고, 닫으면 워크스페이스 편집으로 돌아간다. 상태를
 * 직접 만들지 않고 props/onClose 콜백으로만 통신하는 표시 전용 컴포넌트다.
 *
 * 결과의 rubric.scores는 criterionId만 보유하므로(설명·만점은 루브릭에 있음),
 * criteria를 함께 받아 criterionId→설명/만점으로 매핑해 사람이 읽는 형태로 보여준다.
 * 구 GradingResultPanel(알고리즘 표준입출력)과 별개의 컴포넌트다.
 *
 * 사용처: features/solve/ChallengeSolveView (제출 후 결과 표시)
 */
'use client';

import styled from 'styled-components';
import type {
  ChallengeGradingResult,
  RubricCriterion,
} from '@/shared/core/types';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Markdown } from '@/shared/components/ui/Markdown';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChallengeGradingResultPanelProps {
  result: ChallengeGradingResult;
  /** 루브릭 항목(설명·만점) — 결과의 criterionId를 사람이 읽는 형태로 매핑한다 */
  criteria: RubricCriterion[];
  onClose: () => void;
}

type ScoreTone = 'success' | 'warning' | 'danger';

// ── Helpers ───────────────────────────────────────────────────────────────

/** 최종 점수(0~100)에 따른 색조 — 80↑ 우수·50↑ 보통·그 외 미흡 */
function pickScoreTone(score: number): ScoreTone {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeGradingResultPanel({
  result,
  criteria,
  onClose,
}: ChallengeGradingResultPanelProps) {
  const { autoTest, rubric, finalScore } = result;
  const allTestsPassed =
    autoTest.totalCount > 0 && autoTest.passedCount === autoTest.totalCount;

  return (
    <Overlay onClick={onClose}>
      {/* 패널 내부 클릭이 배경 클릭(닫힘)으로 전파되지 않게 막는다 */}
      <ModalShell onClick={(event) => event.stopPropagation()}>
        <Panel
          title="채점 결과"
          actions={
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
          }
        >
          <ScoreBlock>
            <ScoreNumber $tone={pickScoreTone(finalScore)}>{finalScore}</ScoreNumber>
            <ScoreMax>/ 100</ScoreMax>
          </ScoreBlock>

          <SummaryRow>
            <SummaryLabel>자동 테스트</SummaryLabel>
            <Badge
              tone={
                autoTest.totalCount === 0
                  ? 'neutral'
                  : allTestsPassed
                    ? 'success'
                    : 'danger'
              }
            >
              {autoTest.passedCount}/{autoTest.totalCount} 통과
            </Badge>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>루브릭</SummaryLabel>
            <Badge tone="info">
              {rubric.totalScore}/{rubric.maxScore}점
            </Badge>
          </SummaryRow>

          <SectionTitle>루브릭 항목</SectionTitle>
          <CriterionList>
            {rubric.scores.map((score) => {
              const criterion = criteria.find((item) => item.id === score.criterionId);
              return (
                <CriterionItem key={score.criterionId}>
                  <CriterionHeader>
                    <CriterionDesc>
                      {criterion?.description ?? score.criterionId}
                    </CriterionDesc>
                    <CriterionScore>
                      {score.score}/{criterion?.maxScore ?? 0}
                    </CriterionScore>
                  </CriterionHeader>
                  <CriterionReason>{score.reason}</CriterionReason>
                </CriterionItem>
              );
            })}
          </CriterionList>

          <SectionTitle>종합 피드백</SectionTitle>
          <Feedback>
            <Markdown>{rubric.feedback}</Markdown>
          </Feedback>
        </Panel>
      </ModalShell>
    </Overlay>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

// 배경 스크림은 전용 토큰이 없어 가장 어두운 background 토큰에 알파를 붙여 만든다
// (Badge의 `${color}22` 패턴과 동일 — 하드코딩 색상 금지 규칙 준수).
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.lg}`};
  background: ${({ theme }) => `${theme.colors.background}cc`};
`;

const ModalShell = styled.div`
  width: min(560px, 100%);
`;

const ScoreBlock = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ScoreNumber = styled.span<{ $tone: ScoreTone }>`
  font-size: 44px;
  line-height: 1;
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $tone }) => theme.colors[$tone]};
`;

const ScoreMax = styled.span`
  font-size: ${({ theme }) => theme.font.sizeLg};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const SummaryLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SectionTitle = styled.h2`
  margin: ${({ theme }) => `${theme.spacing.lg} 0 ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const CriterionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CriterionItem = styled.li`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const CriterionHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CriterionDesc = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;
`;

const CriterionScore = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
`;

const CriterionReason = styled.p`
  margin: ${({ theme }) => `${theme.spacing.xs} 0 0`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  word-break: break-word;
`;

const Feedback = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: ${({ theme }) => theme.spacing.sm};
`;
