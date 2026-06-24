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

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type { ChallengeProblem, ProjectFiles } from '@/shared/core/types';
import {
  useSubmissionStore,
  type StoredSubmission,
  type SubmissionPromptTurn,
} from '@/shared/core/stores/submissionStore';
import {
  diffFileSets,
  type DiffLineType,
  type FileDiff,
} from '@/shared/lib/utils/lineDiff';
import { Panel } from '@/shared/components/ui/Panel';

// ── Types ─────────────────────────────────────────────────────────────────

interface GradingDashboardViewProps {
  challenge: ChallengeProblem;
}

/** 풀이 타임라인 1스텝 — 학생 프롬프트 + 그에 대한 AI 응답 + 그 프롬프트가 만든 코드 변경. */
interface TimelineStep {
  prompt: string;
  /** 이 프롬프트 다음에 온 AI 응답(여러 개면 합침). */
  response: string;
  /** 이 프롬프트 작성 시점 → 다음 프롬프트(또는 최종) 사이의 파일별 변경 diff. */
  diffs: FileDiff[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * 대화 트랜스크립트 + 최종 제출 파일로 "프롬프트별 코드 변경" 타임라인을 만든다.
 * 각 user 턴의 filesAtSend(작성 시점 스냅샷)를 다음 user 턴의 스냅샷(없으면 최종
 * 제출본)과 비교해, 그 프롬프트가 유발한 변경점을 계산한다.
 */
function buildTimeline(
  prompts: SubmissionPromptTurn[],
  finalFiles: ProjectFiles,
): TimelineStep[] {
  const userTurns = prompts
    .map((turn, index) => ({ turn, index }))
    .filter((entry) => entry.turn.role === 'user');

  return userTurns.map((entry, order) => {
    const before = entry.turn.filesAtSend ?? {};
    const next = userTurns[order + 1];
    const after = next ? next.turn.filesAtSend ?? {} : finalFiles;
    // 이 프롬프트 다음 ~ 다음 프롬프트 전까지의 assistant 응답을 모은다.
    const responseEnd = next ? next.index : prompts.length;
    const response = prompts
      .slice(entry.index + 1, responseEnd)
      .filter((turn) => turn.role === 'assistant')
      .map((turn) => turn.text)
      .join('\n\n');
    return { prompt: entry.turn.text, response, diffs: diffFileSets(before, after) };
  });
}

/** 스텝 전체의 추가/삭제 라인 합계를 "+n −m" 으로. */
function formatDiffStat(diffs: FileDiff[]): string {
  let added = 0;
  let removed = 0;
  for (const fileDiff of diffs) {
    added += fileDiff.stat.added;
    removed += fileDiff.stat.removed;
  }
  return `+${added} −${removed}`;
}

function fileDiffTag(fileDiff: FileDiff): string {
  if (fileDiff.status === 'added') return '추가';
  if (fileDiff.status === 'removed') return '삭제';
  return '수정';
}

function diffSign(type: DiffLineType): string {
  if (type === 'add') return '+';
  if (type === 'del') return '−';
  return ' ';
}

// ── 집계(통계) ──────────────────────────────────────────────────────────────

/** 제출 정렬 기준. */
type SortKey = 'recent' | 'scoreDesc' | 'scoreAsc' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: '최신순' },
  { key: 'scoreDesc', label: '점수 높은순' },
  { key: 'scoreAsc', label: '점수 낮은순' },
  { key: 'name', label: '이름순' },
];

interface SubmissionStats {
  count: number;
  avg: number;
  median: number;
  max: number;
  /** 자동 테스트 평균 통과율(0~100). */
  avgTestRate: number;
  /** AI 질문 수 중앙값(aiUsage 있는 제출 기준). */
  medianQuestions: number;
}

/** 정렬된 수 배열의 중앙값(빈 배열은 0). */
function medianOf(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStats(subs: StoredSubmission[]): SubmissionStats {
  if (subs.length === 0) {
    return { count: 0, avg: 0, median: 0, max: 0, avgTestRate: 0, medianQuestions: 0 };
  }
  const scores = subs.map((s) => s.result.finalScore).sort((a, b) => a - b);
  const sum = scores.reduce((a, b) => a + b, 0);
  const testRate =
    subs.reduce((acc, s) => {
      const { passedCount, totalCount } = s.result.autoTest;
      return acc + (totalCount > 0 ? passedCount / totalCount : 0);
    }, 0) / subs.length;
  const questions = subs
    .map((s) => s.aiUsage?.questionsUsed)
    .filter((q): q is number => typeof q === 'number')
    .sort((a, b) => a - b);
  return {
    count: subs.length,
    avg: Math.round(sum / subs.length),
    median: Math.round(medianOf(scores)),
    max: Math.round(Math.max(...scores)),
    avgTestRate: Math.round(testRate * 100),
    medianQuestions: Math.round(medianOf(questions)),
  };
}

/** 점수 구간(히스토그램). */
const SCORE_BUCKETS = [
  { label: '0–59', min: 0, max: 59 },
  { label: '60–69', min: 60, max: 69 },
  { label: '70–79', min: 70, max: 79 },
  { label: '80–89', min: 80, max: 89 },
  { label: '90–100', min: 90, max: 100 },
];

function scoreHistogram(subs: StoredSubmission[]): { label: string; count: number }[] {
  return SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: subs.filter((s) => {
      const value = Math.round(s.result.finalScore);
      return value >= bucket.min && value <= bucket.max;
    }).length,
  }));
}

/** 한 루브릭 항목의 제출 평균 점수(소수 1자리). 채점한 제출이 없으면 0. */
function criterionAverage(subs: StoredSubmission[], criterionId: string): number {
  let sum = 0;
  let n = 0;
  for (const s of subs) {
    const found = s.result.rubric.scores.find((x) => x.criterionId === criterionId);
    if (found) {
      sum += found.score;
      n += 1;
    }
  }
  return n > 0 ? Math.round((sum / n) * 10) / 10 : 0;
}

function sortSubmissions(subs: StoredSubmission[], sortBy: SortKey): StoredSubmission[] {
  return [...subs].sort((a, b) => {
    switch (sortBy) {
      case 'scoreDesc':
        return b.result.finalScore - a.result.finalScore;
      case 'scoreAsc':
        return a.result.finalScore - b.result.finalScore;
      case 'name':
        return a.studentName.localeCompare(b.studentName);
      case 'recent':
      default:
        return b.result.submittedAt - a.result.submittedAt;
    }
  });
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

  // 정렬·이름 필터(집계 뷰 상호작용).
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [nameQuery, setNameQuery] = useState('');

  const stats = computeStats(submissions);
  const histogram = scoreHistogram(submissions);
  const maxBucketCount = Math.max(1, ...histogram.map((bucket) => bucket.count));

  // 표시 목록 = 이름 필터 적용 후 선택 기준으로 정렬.
  const query = nameQuery.trim().toLowerCase();
  const displayedSubmissions = sortSubmissions(
    query ? submissions.filter((s) => s.studentName.toLowerCase().includes(query)) : submissions,
    sortBy,
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
              {stats.count > 0 && ` · 제출 ${stats.count}건 평균`}
            </CriterionHeaderHint>
          </CriterionHeader>
          <CriterionList>
            {rubric.criteria.map((criterion, index) => (
              <CriterionRow key={criterion.id}>
                <CriterionDesc>
                  #{index + 1} {criterion.description || '(설명 없음)'}
                </CriterionDesc>
                <CriterionScore>
                  {stats.count > 0 && (
                    <CriterionAvg>평균 {criterionAverage(submissions, criterion.id)}</CriterionAvg>
                  )}
                  만점 {criterion.maxScore}점
                </CriterionScore>
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

        <Panel title={`학생 제출 (${submissions.length})`}>
          {submissions.length === 0 ? (
            <PlaceholderBox>
              <PlaceholderTitle>아직 제출이 없습니다</PlaceholderTitle>
              <PlaceholderBody>
                학생이 풀이 화면에서 <strong>제출</strong>하면 채점 결과가 이 목록에
                점수·제출자 이름과 함께 쌓입니다. (인증이 없는 MVP라 이 브라우저에서 이뤄진
                제출만 표시됩니다.)
              </PlaceholderBody>
            </PlaceholderBox>
          ) : (
            <>
              <StatBand>
                <StatGroup>
                  <Stat>
                    <StatNum>{stats.avg}</StatNum>
                    <StatLabel>평균</StatLabel>
                  </Stat>
                  <Stat>
                    <StatNum>{stats.median}</StatNum>
                    <StatLabel>중앙값</StatLabel>
                  </Stat>
                  <Stat>
                    <StatNum>{stats.max}</StatNum>
                    <StatLabel>최고</StatLabel>
                  </Stat>
                  <Stat>
                    <StatNum>{stats.avgTestRate}%</StatNum>
                    <StatLabel>테스트 평균</StatLabel>
                  </Stat>
                  <Stat>
                    <StatNum>{stats.medianQuestions}</StatNum>
                    <StatLabel>질문 중앙값</StatLabel>
                  </Stat>
                </StatGroup>
                <Histogram>
                  {histogram.map((bucket) => (
                    <HistoBar key={bucket.label} title={`${bucket.label}: ${bucket.count}명`}>
                      <HistoFill
                        style={{ height: `${(bucket.count / maxBucketCount) * 100}%` }}
                        $empty={bucket.count === 0}
                      />
                      <HistoCount>{bucket.count}</HistoCount>
                      <HistoLabel>{bucket.label}</HistoLabel>
                    </HistoBar>
                  ))}
                </Histogram>
              </StatBand>

              <Controls>
                <SortSelect
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortKey)}
                  aria-label="정렬 기준"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </SortSelect>
                <SearchInput
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.target.value)}
                  placeholder="이름 검색"
                  aria-label="제출자 이름 검색"
                />
              </Controls>

              {displayedSubmissions.length === 0 ? (
                <MutedNote>검색 결과가 없습니다.</MutedNote>
              ) : (
                <SubmissionList>
                  {displayedSubmissions.map((submission) => {
                const prompts = submission.prompts ?? [];
                const finalFiles = submission.submittedFiles ?? {};
                const codeEntries = Object.entries(finalFiles);
                const timeline = buildTimeline(prompts, finalFiles);
                return (
                  <SubmissionItem key={submission.id}>
                    <SubmissionSummary>
                      <StudentName>{submission.studentName}</StudentName>
                      <SubmittedAt>{formatTime(submission.result.submittedAt)}</SubmittedAt>
                      <TestMeta>
                        테스트 {submission.result.autoTest.passedCount}/
                        {submission.result.autoTest.totalCount}
                      </TestMeta>
                      {submission.aiUsage && (
                        <TestMeta>
                          질문 {submission.aiUsage.questionsUsed} · 토큰{' '}
                          {submission.aiUsage.tokensUsed.toLocaleString()}
                        </TestMeta>
                      )}
                      <ScoreBadge $score={Math.round(submission.result.finalScore)}>
                        {Math.round(submission.result.finalScore)}점
                      </ScoreBadge>
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

                    <Detail open>
                      <DetailSummary>풀이 타임라인 — 프롬프트별 코드 변경 ({timeline.length})</DetailSummary>
                      <DetailBody>
                        {timeline.length === 0 ? (
                          <MutedNote>기록된 AI 대화가 없습니다.</MutedNote>
                        ) : (
                          <Timeline>
                            {timeline.map((step, index) => (
                              <Step key={index}>
                                <StepHead>
                                  <StepNo>#{index + 1}</StepNo>
                                  <StepPrompt>{step.prompt || '(빈 프롬프트)'}</StepPrompt>
                                  <StepStat>{formatDiffStat(step.diffs)}</StepStat>
                                </StepHead>
                                {step.response && (
                                  <StepResponse>
                                    <DetailSummary>AI 응답</DetailSummary>
                                    <ResponseText>{step.response}</ResponseText>
                                  </StepResponse>
                                )}
                                {step.diffs.length === 0 ? (
                                  <MutedNote>이 프롬프트 구간에는 코드 변경이 없습니다.</MutedNote>
                                ) : (
                                  step.diffs.map((fileDiff) => (
                                    <DiffFile key={fileDiff.path}>
                                      <DiffFileHead>
                                        <CodePath>{fileDiff.path}</CodePath>
                                        <DiffFileTag>{fileDiffTag(fileDiff)}</DiffFileTag>
                                      </DiffFileHead>
                                      <DiffPre>
                                        {fileDiff.lines.map((line, lineIndex) => (
                                          <DiffLineRow key={lineIndex} $type={line.type}>
                                            <DiffSign>{diffSign(line.type)}</DiffSign>
                                            <DiffText>{line.text}</DiffText>
                                          </DiffLineRow>
                                        ))}
                                      </DiffPre>
                                    </DiffFile>
                                  ))
                                )}
                              </Step>
                            ))}
                          </Timeline>
                        )}
                      </DetailBody>
                    </Detail>

                    <Detail>
                      <DetailSummary>최종 제출 코드 ({codeEntries.length}개 파일)</DetailSummary>
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
            </>
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
  display: inline-flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

// 항목별 제출 평균 — 만점 옆에 무채색으로(어느 기준에서 막혔는지 한눈에).
const CriterionAvg = styled.span`
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const AiMeta = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

// ── 집계 band / 정렬·필터 컨트롤 ─────────────────────────────────────────────

const StatBand = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const StatGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StatNum = styled.span`
  font-size: ${({ theme }) => theme.font.sizeLg};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

// 점수 분포 히스토그램 — 구간별 막대.
const Histogram = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.xs};
  height: 64px;
`;

const HistoBar = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  width: 34px;
  height: 100%;
`;

const HistoFill = styled.div<{ $empty: boolean }>`
  width: 100%;
  min-height: ${({ $empty }) => ($empty ? '0' : '3px')};
  background: ${({ theme, $empty }) =>
    $empty ? 'transparent' : theme.colors.primary};
  border-radius: 2px;
`;

const HistoCount = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const HistoLabel = styled.span`
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const SortSelect = styled.select`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
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

// 점수대별 색으로 한눈에 구분: 80↑ 강조(primary) · 60–79 주의(warning) · 60 미만 위험(danger).
const ScoreBadge = styled.span<{ $score: number }>`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $score }) =>
    $score >= 80
      ? theme.colors.primary
      : $score >= 60
        ? theme.colors.warning
        : theme.colors.danger};
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

// 풀이 타임라인 — 프롬프트(스텝)를 세로로 쌓는다.
const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Step = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding-left: ${({ theme }) => theme.spacing.sm};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
`;

const StepHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StepNo = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const StepPrompt = styled.span`
  flex: 1;
  min-width: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
`;

const StepStat = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const StepResponse = styled.details`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ResponseText = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: pre-wrap;
  word-break: break-word;
`;

const DiffFile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const DiffFileHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const DiffFileTag = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DiffPre = styled.div`
  max-height: 320px;
  overflow: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1.5;
`;

// diff 한 줄 — 추가(초록)/삭제(빨강)/유지(기본) 배경. 좌측 부호 거터.
const DiffLineRow = styled.div<{ $type: DiffLineType }>`
  display: flex;
  white-space: pre;
  background: ${({ $type }) =>
    $type === 'add'
      ? 'rgba(80, 200, 120, 0.12)'
      : $type === 'del'
        ? 'rgba(255, 91, 110, 0.12)'
        : 'transparent'};
  color: ${({ theme, $type }) =>
    $type === 'context' ? theme.colors.textMuted : theme.colors.text};
`;

const DiffSign = styled.span`
  flex: 0 0 1.4em;
  text-align: center;
  user-select: none;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DiffText = styled.span`
  flex: 1;
  padding-right: ${({ theme }) => theme.spacing.sm};
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
