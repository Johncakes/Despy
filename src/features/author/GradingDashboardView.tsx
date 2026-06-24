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
          이 과제의 학생 제출·점수를 모아 보는 화면입니다. 점수가 어떻게 계산되는지는 아래
          &lsquo;채점 기준&rsquo;을 참고하세요.
        </Subtitle>
      </Header>

      <Grid>
        <Panel title="채점 기준">
          <ScoreModel>
            <ScoreModelHead>최종 점수는 0~100점 — 두 축을 가중 합산합니다</ScoreModelHead>
            <Formula>
              최종 = 자동 테스트 통과율 × {formatWeight(rubric.weights.tests)} + 루브릭 득점률 ×{' '}
              {formatWeight(rubric.weights.rubric)}
            </Formula>
            <ModelList>
              <ModelItem>
                <strong>자동 테스트 {formatWeight(rubric.weights.tests)}</strong> — 채점용 테스트를
                돌려 나온 통과 비율(통과 수 ÷ 전체 수)을 점수로 환산.
              </ModelItem>
              <ModelItem>
                <strong>AI 루브릭 {formatWeight(rubric.weights.rubric)}</strong> — 아래 항목들을 AI가
                정성 평가한 점수의 합 ÷ 만점({maxScoreSum}점)을 점수로 환산.
              </ModelItem>
            </ModelList>
          </ScoreModel>

          <CriterionHeader>
            AI 루브릭 항목
            <CriterionHeaderHint>
              합 {maxScoreSum}점 만점 · 득점률이 {formatWeight(rubric.weights.rubric)}로 환산
            </CriterionHeaderHint>
          </CriterionHeader>
          <CriterionList>
            {rubric.criteria.map((criterion, index) => (
              <CriterionRow key={criterion.id}>
                <CriterionDesc>
                  #{index + 1} {criterion.description || '(설명 없음)'}
                </CriterionDesc>
                <CriterionScore>만점 {criterion.maxScore}점</CriterionScore>
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
              {sortedSubmissions.map((submission) => {
                const prompts = submission.prompts ?? [];
                const userTurnCount = prompts.filter((turn) => turn.role === 'user').length;
                const codeEntries = Object.entries(submission.submittedFiles ?? {});
                return (
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

                    <Detail>
                      <DetailSummary>학생 프롬프트 ({userTurnCount})</DetailSummary>
                      <DetailBody>
                        {prompts.length === 0 ? (
                          <MutedNote>기록된 AI 대화가 없습니다.</MutedNote>
                        ) : (
                          <Transcript>
                            {prompts.map((turn, index) => (
                              <Turn key={index} $role={turn.role}>
                                <TurnRole $role={turn.role}>
                                  {turn.role === 'user' ? '학생' : 'AI'}
                                </TurnRole>
                                <TurnText>{turn.text || '(빈 메시지)'}</TurnText>
                              </Turn>
                            ))}
                          </Transcript>
                        )}
                      </DetailBody>
                    </Detail>

                    <Detail>
                      <DetailSummary>제출 코드 ({codeEntries.length}개 파일)</DetailSummary>
                      <DetailBody>
                        {codeEntries.length === 0 ? (
                          <MutedNote>템플릿 대비 변경된 파일이 없습니다.</MutedNote>
                        ) : (
                          codeEntries.map(([path, contents]) => (
                            <CodeFile key={path}>
                              <CodePath>{path}</CodePath>
                              <CodeBlock>{contents}</CodeBlock>
                            </CodeFile>
                          ))
                        )}
                      </DetailBody>
                    </Detail>
                  </SubmissionItem>
                );
              })}
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

const ScoreModel = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ScoreModelHead = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

// 계산식 — 학생/교수가 한눈에 보도록 강조색으로.
const Formula = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.primary};
`;

const ModelList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ModelItem = styled.li`
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

// 루브릭 항목 목록 헤더 — 좌측 제목 + 우측 "합/환산" 힌트.
const CriterionHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const CriterionHeaderHint = styled.span`
  font-weight: 400;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: right;
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

const MutedNote = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

// 대화 트랜스크립트 — 학생/AI 턴을 세로로 쌓고 역할(좌측 색 바)로 구분.
const Transcript = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Turn = styled.div<{ $role: 'user' | 'assistant' }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
  border-left: 3px solid
    ${({ theme, $role }) =>
      $role === 'user' ? theme.colors.primary : theme.colors.border};
`;

const TurnRole = styled.span<{ $role: 'user' | 'assistant' }>`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $role }) =>
    $role === 'user' ? theme.colors.primary : theme.colors.textMuted};
`;

const TurnText = styled.div`
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
`;

const CodeFile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  & + & {
    margin-top: ${({ theme }) => theme.spacing.sm};
  }
`;

const CodePath = styled.div`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

// 제출 코드 — 모노스페이스 블록(가로/세로 스크롤, 줄바꿈 보존).
const CodeBlock = styled.pre`
  margin: 0;
  max-height: 320px;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.text};
  white-space: pre;
  tab-size: 2;
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
