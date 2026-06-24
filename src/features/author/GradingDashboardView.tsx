/**
 * GradingDashboardView.tsx — 교수 채점 대시보드
 *
 * 특정 과제의 채점 현황을 보여주는 교수용 화면. 채점 기준(루브릭·AI정책) 요약과 함께,
 * 학생이 풀이 화면에서 제출해 저장된 채점 결과 목록(submissionStore)을 점수·시각·제출자
 * 이름과 함께 최신순으로 보여주고, 각 제출을 펼쳐 루브릭 항목별 점수·피드백을 확인한다.
 *
 * ⚠️ MVP 한계: 인증·교수/학생 분리·서버 집계는 범위 밖이라, 이 목록은 **이 브라우저에서
 *    이뤄진 제출들**이며 제출자 식별은 입력한 이름/별명에 의존한다(submissionStore 참조).
 *
 * 과제는 props로 주입받는다(DI). 제출 목록은 challengeId로 submissionStore에서 조회한다.
 *
 * 사용처: app/author/challenge/[challengeId]/submissions/page.tsx
 */
'use client';

import Link from 'next/link';
import styled from 'styled-components';
import type { ChallengeProblem } from '@/shared/core/types';
import { useSubmissionStore } from '@/shared/core/stores/submissionStore';
import { Panel } from '@/shared/components/ui/Panel';

// ── Types ─────────────────────────────────────────────────────────────────

interface GradingDashboardViewProps {
  challenge: ChallengeProblem;
}

// ── Component ─────────────────────────────────────────────────────────────

export function GradingDashboardView({ challenge }: GradingDashboardViewProps) {
  const { rubric, aiPolicy } = challenge;
  const maxScoreSum = rubric.criteria.reduce(
    (sum, criterion) => sum + criterion.maxScore,
    0,
  );

  // 이 과제의 제출 목록(없으면 undefined → 빈 배열은 selector 밖에서 만들어 참조 안정 유지).
  const storedSubmissions = useSubmissionStore(
    (state) => state.submissions[challenge.id],
  );
  const submissions = storedSubmissions ?? [];
  // 최신 제출이 위로 오도록 제출 시각 내림차순 정렬(원본 불변).
  const sortedSubmissions = [...submissions].sort(
    (a, b) => b.result.submittedAt - a.result.submittedAt,
  );

  // 루브릭 항목 id → 설명(제출 상세에서 점수 옆에 표시).
  const criterionLabel = (criterionId: string): string =>
    rubric.criteria.find((criterion) => criterion.id === criterionId)?.description ??
    criterionId;

  return (
    <Layout>
      <Header>
        <BackLink href="/author/challenge">← 과제 출제로 돌아가기</BackLink>
        <Title>채점 대시보드 — {challenge.title || '(제목 없음)'}</Title>
        <Subtitle>
          이 과제의 학생 제출·점수를 모아 볼 화면입니다. 자세한 채점 기준은 아래 루브릭을
          참고하세요.
        </Subtitle>
      </Header>

      <Grid>
        <Panel title="채점 기준 (루브릭)">
          <RubricMeta>
            가중치 — 자동 테스트 {formatWeight(rubric.weights.tests)} · AI 루브릭{' '}
            {formatWeight(rubric.weights.rubric)} / 루브릭 만점 합 {maxScoreSum}점
          </RubricMeta>
          <CriterionList>
            {rubric.criteria.map((criterion, index) => (
              <CriterionRow key={criterion.id}>
                <CriterionDesc>
                  #{index + 1} {criterion.description || '(설명 없음)'}
                </CriterionDesc>
                <CriterionScore>{criterion.maxScore}점</CriterionScore>
              </CriterionRow>
            ))}
            {rubric.criteria.length === 0 && (
              <Empty>등록된 루브릭 항목이 없습니다.</Empty>
            )}
          </CriterionList>
          <AiMeta>
            AI 정책 — 모델 {aiPolicy.model} · 질문 {aiPolicy.maxQuestions}회 · 토큰{' '}
            {aiPolicy.maxTokens.toLocaleString()}
          </AiMeta>
        </Panel>

        <Panel title={`학생 제출 (${sortedSubmissions.length})`}>
          {sortedSubmissions.length === 0 ? (
            <PlaceholderBox>
              <PlaceholderTitle>아직 제출이 없습니다</PlaceholderTitle>
              <PlaceholderBody>
                학생이 풀이 화면에서 <strong>제출</strong>하면 채점 결과가 이 목록에
                점수·제출자 이름과 함께 쌓입니다. (인증이 없는 MVP라 이 브라우저에서 이뤄진
                제출만 표시됩니다.)
              </PlaceholderBody>
            </PlaceholderBox>
          ) : (
            <SubmissionList>
              {sortedSubmissions.map((submission) => (
                <SubmissionItem key={submission.id}>
                  <SubmissionSummary>
                    <StudentName>{submission.studentName}</StudentName>
                    <SubmittedAt>{formatTime(submission.result.submittedAt)}</SubmittedAt>
                    <TestMeta>
                      테스트 {submission.result.autoTest.passedCount}/
                      {submission.result.autoTest.totalCount}
                    </TestMeta>
                    <ScoreBadge>{Math.round(submission.result.finalScore)}점</ScoreBadge>
                  </SubmissionSummary>
                  <Detail>
                    <DetailSummary>루브릭 항목별 점수·피드백</DetailSummary>
                    <DetailBody>
                      <CriterionScoreList>
                        {submission.result.rubric.scores.map((score) => (
                          <CriterionScoreRow key={score.criterionId}>
                            <CriterionScoreDesc>
                              {criterionLabel(score.criterionId)}
                            </CriterionScoreDesc>
                            <CriterionScoreValue>{score.score}점</CriterionScoreValue>
                          </CriterionScoreRow>
                        ))}
                      </CriterionScoreList>
                      {submission.result.rubric.feedback && (
                        <FeedbackText>{submission.result.rubric.feedback}</FeedbackText>
                      )}
                    </DetailBody>
                  </Detail>
                </SubmissionItem>
              ))}
            </SubmissionList>
          )}
        </Panel>
      </Grid>
    </Layout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatWeight(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Styled Components ─────────────────────────────────────────────────────

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  height: 100%;
  min-height: 0;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.primary};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
  color: ${({ theme }) => theme.colors.text};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 0;
  flex: 1;
`;

const RubricMeta = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CriterionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const CriterionRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const CriterionDesc = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
`;

const CriterionScore = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const AiMeta = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PlaceholderBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const PlaceholderTitle = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const PlaceholderBody = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const SubmissionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  overflow-y: auto;
`;

const SubmissionItem = styled.li`
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const SubmissionSummary = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StudentName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const SubmittedAt = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const TestMeta = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const ScoreBadge = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const Detail = styled.details`
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const DetailSummary = styled.summary`
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DetailBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
`;

const CriterionScoreList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const CriterionScoreRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CriterionScoreDesc = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
`;

const CriterionScoreValue = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const FeedbackText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: pre-wrap;
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
