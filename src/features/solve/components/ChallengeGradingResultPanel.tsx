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
 * 점수 투명성: 최종 점수가 "자동 테스트 통과율 × 비중 + 루브릭 득점률 × 비중"의
 * 가중합(computeFinalScore와 동일 식)임을 산출표로 보여주고, 자동 테스트는 케이스별
 * 통과/실패·실패 메시지까지 펼쳐 학생이 점수 근거를 검증할 수 있게 한다.
 *
 * 무결성 고지: 자동 테스트 점수 축은 학생 브라우저(WebContainer) 실행 결과를 그대로
 * 반영하며 서버가 재실행해 검증하지 않는다(참고 신호 — 한계 명시). 테스트가 없는데
 * 테스트 비중이 남아 있으면 그 축이 0점이 되어 최종 점수가 깎임도 함께 고지한다.
 *
 * 사용처: features/solve/ChallengeSolveView (제출 후 결과 표시)
 */
'use client';

import styled from 'styled-components';
import type {
  ChallengeGradingResult,
  GradingRubric,
  RubricCriterion,
} from '@/shared/core/types';
import {
  formatMlValue,
  mlMetricMeta,
  mlScoreRatio,
} from '@/shared/lib/grader/mlScore';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Markdown } from '@/shared/components/ui/Markdown';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChallengeGradingResultPanelProps {
  result: ChallengeGradingResult;
  /** 루브릭 항목(설명·만점) — 결과의 criterionId를 사람이 읽는 형태로 매핑한다 */
  criteria: RubricCriterion[];
  /** 최종 점수 가중치(tests/rubric) — 점수 산출 과정을 투명하게 보여주기 위함 */
  weights: GradingRubric['weights'];
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

/** 비율(0~1)을 정수 퍼센트 문자열로 — 통과율·득점률·비중 표시용 */
function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeGradingResultPanel({
  result,
  criteria,
  weights,
  onClose,
}: ChallengeGradingResultPanelProps) {
  const { autoTest, rubric, finalScore, ml } = result;
  const isMl = ml != null;
  const allTestsPassed =
    autoTest.totalCount > 0 && autoTest.passedCount === autoTest.totalCount;

  // 최종 점수 산출(서버 computeFinalScore와 동일 식)을 그대로 풀어 보여준다.
  // 분모 0(테스트/항목 없음)은 0%로 처리한다. ML 챌린지는 객관 축이 자동 테스트가
  // 아니라 성능 지표라, objectiveRatio를 mlScoreRatio로 환산한다(metric 방향 반영).
  const testsRatio =
    autoTest.totalCount > 0 ? autoTest.passedCount / autoTest.totalCount : 0;
  const objectiveRatio = ml
    ? mlScoreRatio(ml.metric, ml.value, ml.passThreshold)
    : testsRatio;
  const rubricRatio = rubric.maxScore > 0 ? rubric.totalScore / rubric.maxScore : 0;
  const objectiveContribution = objectiveRatio * weights.tests * 100;
  const rubricContribution = rubricRatio * weights.rubric * 100;
  const mlMeta = ml ? mlMetricMeta(ml.metric) : null;

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

          <SectionTitle>점수 산출 방식</SectionTitle>
          <Breakdown>
            <BreakdownRow>
              <BreakdownMain>
                <BreakdownLabel>{isMl ? '성능 점수' : '자동 테스트'}</BreakdownLabel>
                <BreakdownContribution>
                  +{objectiveContribution.toFixed(1)}점
                </BreakdownContribution>
              </BreakdownMain>
              <BreakdownDetail>
                {ml ? (
                  <>
                    {mlMeta?.label} {formatMlValue(ml.metric, ml.value)} ·{' '}
                    {ml.passed ? '합격' : '불합격'} · 환산 {formatPercent(objectiveRatio)}{' '}
                    × 비중 {formatPercent(weights.tests)}
                  </>
                ) : (
                  <>
                    {autoTest.passedCount}/{autoTest.totalCount} 통과 · 통과율{' '}
                    {formatPercent(testsRatio)} × 비중 {formatPercent(weights.tests)}
                  </>
                )}
              </BreakdownDetail>
            </BreakdownRow>
            <BreakdownRow>
              <BreakdownMain>
                <BreakdownLabel>AI 루브릭</BreakdownLabel>
                <BreakdownContribution>
                  +{rubricContribution.toFixed(1)}점
                </BreakdownContribution>
              </BreakdownMain>
              <BreakdownDetail>
                {rubric.totalScore}/{rubric.maxScore}점 · 득점률{' '}
                {formatPercent(rubricRatio)} × 비중 {formatPercent(weights.rubric)}
              </BreakdownDetail>
            </BreakdownRow>
            <BreakdownTotal>
              <span>최종 점수 (가중합 반올림)</span>
              <strong>{finalScore} / 100</strong>
            </BreakdownTotal>
          </Breakdown>

          {/* ML 챌린지: 성능 점수(객관) 상세 — 지표값·합격 기준·게이지 + 무결성 한계 고지. */}
          {ml && mlMeta && (
            <>
              <SectionTitle>
                성능 점수
                <Badge tone={ml.passed ? 'success' : 'danger'}>
                  {ml.passed ? '합격' : '불합격'}
                </Badge>
              </SectionTitle>
              <MlScoreBox>
                <MlScoreRow>
                  <MlScoreLabel>{mlMeta.label}</MlScoreLabel>
                  <MlScoreValue $tone={ml.passed ? 'success' : 'danger'}>
                    {formatMlValue(ml.metric, ml.value)}
                  </MlScoreValue>
                </MlScoreRow>
                <MlGaugeTrack>
                  <MlGaugeFill
                    $percent={objectiveRatio * 100}
                    $tone={ml.passed ? 'success' : 'danger'}
                  />
                </MlGaugeTrack>
                <BreakdownDetail>
                  합격 기준 {mlMeta.higherIsBetter ? '≥' : '≤'}{' '}
                  {formatMlValue(ml.metric, ml.passThreshold)} · 숨겨진 test셋 기준
                </BreakdownDetail>
              </MlScoreBox>
              <IntegrityNote>
                ⚠ 성능 점수는 학생 브라우저(WebContainer)에서 숨겨진 test셋으로 계산되며,
                서버가 다시 실행해 검증하지 않습니다(참고 신호 — 한계). seed 고정으로 점수
                변동을 줄였으나 데이터 누수를 완벽히 막지는 못합니다.
              </IntegrityNote>
            </>
          )}

          {/* 워크스페이스 과제: 자동 테스트 상세 + 무결성 고지(ML 챌린지는 위 성능 점수로 대체). */}
          {!isMl && (
            <>
              {/* 무결성 고지: 자동 테스트 점수 축은 학생 브라우저(WebContainer)에서 실행된
                  결과를 그대로 반영하며 서버가 재실행해 검증하지 않는다(참고 신호 — 한계 명시). */}
              {autoTest.totalCount > 0 && (
                <IntegrityNote>
                  ⚠ 자동 테스트 통과 수는 학생 브라우저(WebContainer)에서 실행된 결과를 그대로
                  반영합니다 — 서버가 다시 실행해 검증하지 않으므로, 이 점수 축은 무결성에 한계가
                  있습니다(참고 신호).
                </IntegrityNote>
              )}
              {/* 출제 함정 고지: 테스트가 없는데 테스트 비중이 남아 있으면 그 축이 0점이 되어
                  최종 점수가 루브릭 비중만큼으로 깎인다(#4 — 학생이 사유를 알 수 있게 명시). */}
              {autoTest.totalCount === 0 && weights.tests > 0 && (
                <IntegrityNote>
                  ⚠ 이 과제에는 자동 테스트가 없는데 테스트 비중이 {formatPercent(weights.tests)}로
                  설정돼 있어 테스트 축이 0점으로 처리됩니다 — 최종 점수는 최대{' '}
                  {Math.round(weights.rubric * 100)}점입니다.
                </IntegrityNote>
              )}

              <SectionTitle>
                자동 테스트 상세
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
              </SectionTitle>
              {autoTest.totalCount === 0 ? (
                <EmptyNote>이 과제에는 자동 테스트가 없습니다.</EmptyNote>
              ) : (
                <TestCaseList>
                  {autoTest.cases.map((testCase, index) => (
                    <TestCaseItem key={`${testCase.name}-${index}`}>
                      <TestCaseHeader>
                        <TestCaseStatus $passed={testCase.passed}>
                          {testCase.passed ? '통과' : '실패'}
                        </TestCaseStatus>
                        <TestCaseName>{testCase.name}</TestCaseName>
                      </TestCaseHeader>
                      {!testCase.passed && testCase.message && (
                        <TestCaseMessage>{testCase.message}</TestCaseMessage>
                      )}
                    </TestCaseItem>
                  ))}
                </TestCaseList>
              )}
            </>
          )}

          <SectionTitle>루브릭 항목</SectionTitle>
          <CriterionList>
            {rubric.scores.map((score) => {
              const criterion = criteria.find((item) => item.id === score.criterionId);
              // 점수가 레벨로 스냅됐다면 어느 레벨에 도달했는지 서술자를 함께 보여줘
              // 점수의 근거를 명확히 한다(레벨 점수와 일치하는 항목을 찾는다).
              const reachedLevel = criterion?.levels?.find(
                (level) => level.score === score.score,
              );
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
                  {reachedLevel && (
                    <CriterionLevel>도달 레벨 · {reachedLevel.descriptor}</CriterionLevel>
                  )}
                  <CriterionReason>{score.reason}</CriterionReason>
                  {criterion?.rationale && (
                    <CriterionRationale>배점 근거 · {criterion.rationale}</CriterionRationale>
                  )}
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

const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => `${theme.spacing.lg} 0 ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

// ── 점수 산출표 ───────────────────────────────────────────────────────────────

const Breakdown = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const BreakdownRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const BreakdownMain = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const BreakdownLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const BreakdownContribution = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  font-variant-numeric: tabular-nums;
`;

const BreakdownDetail = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const BreakdownTotal = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};

  strong {
    font-size: ${({ theme }) => theme.font.sizeMd};
    color: ${({ theme }) => theme.colors.text};
    font-variant-numeric: tabular-nums;
  }
`;

// 무결성/한계 고지 — 점수 산출표 아래 작은 경고 문구(자동 테스트 신뢰 한계·테스트 0 비중).
const IntegrityNote = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.5;
`;

// ── ML 성능 점수 상세 ─────────────────────────────────────────────────────────

const MlScoreBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const MlScoreRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const MlScoreLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const MlScoreValue = styled.span<{ $tone: 'success' | 'danger' }>`
  font-size: ${({ theme }) => theme.font.sizeLg};
  font-weight: ${({ theme }) => theme.font.weightBold};
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $tone }) =>
    $tone === 'success' ? theme.colors.success : theme.colors.danger};
`;

const MlGaugeTrack = styled.div`
  width: 100%;
  height: 8px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 4px;
  overflow: hidden;
`;

const MlGaugeFill = styled.div<{ $percent: number; $tone: 'success' | 'danger' }>`
  height: 100%;
  width: ${({ $percent }) => Math.min(Math.max($percent, 0), 100)}%;
  background: ${({ theme, $tone }) =>
    $tone === 'success' ? theme.colors.success : theme.colors.danger};
  border-radius: 4px;
  transition: width 0.5s ease;
`;

// ── 자동 테스트 상세 ──────────────────────────────────────────────────────────

const EmptyNote = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TestCaseList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const TestCaseItem = styled.li`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const TestCaseHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const TestCaseStatus = styled.span<{ $passed: boolean }>`
  flex-shrink: 0;
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $passed }) => ($passed ? theme.colors.success : theme.colors.danger)};
  background: ${({ theme, $passed }) =>
    `${$passed ? theme.colors.success : theme.colors.danger}22`};
`;

const TestCaseName = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;
`;

const TestCaseMessage = styled.pre`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: ${({ theme }) => theme.spacing.sm};
  max-height: 200px;
  overflow: auto;
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.danger};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
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

const CriterionLevel = styled.p`
  margin: ${({ theme }) => `${theme.spacing.xs} 0 0`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  word-break: break-word;
`;

const CriterionReason = styled.p`
  margin: ${({ theme }) => `${theme.spacing.xs} 0 0`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  word-break: break-word;
`;

const CriterionRationale = styled.p`
  margin: ${({ theme }) => `${theme.spacing.xs} 0 0`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  word-break: break-word;
`;

const Feedback = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: ${({ theme }) => theme.spacing.sm};
`;
