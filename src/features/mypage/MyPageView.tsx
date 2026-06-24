/**
 * MyPageView.tsx — 마이페이지 (풀이 이력·진행률 대시보드)
 *
 * 학생이 시도한 알고리즘 문제와 제출한 과제를 한눈에 볼 수 있는 개인 대시보드.
 * solved.ac 스타일로 문제 카드 그리드(통과/부분/미시도)와 과제 제출 이력 목록을
 * 보여준다. 모든 데이터는 로컬 스토어(localStorage)에서 읽는다.
 *
 * 사용처: app/mypage/page.tsx
 */
'use client';

import Link from 'next/link';
import styled, { css, useTheme } from 'styled-components';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { useCurrentUser } from '@/shared/core/queries/authQueries';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { useChallengeStore } from '@/shared/core/stores/challengeStore';
import { useSolveSessionStore } from '@/shared/core/stores/solveSessionStore';
import { useSolveHistoryStore } from '@/shared/core/stores/solveHistoryStore';
import { useSubmissionStore } from '@/shared/core/stores/submissionStore';
import { Badge, type BadgeTone } from '@/shared/components/ui/Badge';
import { Navbar } from '@/shared/components/ui/Navbar';
import type { GradingResult, Problem, UserRole } from '@/shared/core/types';
import type { SolveSession } from '@/shared/core/stores/solveSessionStore';
import type { StoredSubmission } from '@/shared/core/stores/submissionStore';

// ── Constants ─────────────────────────────────────────────────────────────

type ProblemStatus = 'passed' | 'partial' | 'failed' | 'attempted' | 'untried';

const STATUS_CONFIG: Record<ProblemStatus, { label: string; tone: BadgeTone; order: number }> = {
  passed:   { label: '통과',    tone: 'success', order: 1 },
  partial:  { label: '부분',    tone: 'warning', order: 2 },
  failed:   { label: '실패',    tone: 'danger',  order: 3 },
  attempted:{ label: '채점 전', tone: 'info',    order: 4 },
  untried:  { label: '미시도',  tone: 'neutral', order: 5 },
};

// ── Utilities ─────────────────────────────────────────────────────────────

function getProblemStatus(
  session: SolveSession | null,
  result: GradingResult | null,
): ProblemStatus {
  if (!session) return 'untried';
  if (!result || result.totalCount === 0) return 'attempted';
  if (result.passedCount === result.totalCount) return 'passed';
  if (result.passedCount > 0) return 'partial';
  return 'failed';
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days >= 30) return `${Math.floor(days / 30)}달 전`;
  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  if (minutes > 0) return `${minutes}분 전`;
  return '방금 전';
}

function roleLabel(role: UserRole): string {
  return role === 'admin' ? '관리자' : role === 'professor' ? '교수' : '학생';
}

function scoreTone(score: number): BadgeTone {
  if (score >= 90) return 'success';
  if (score >= 70) return 'info';
  if (score >= 50) return 'warning';
  return 'danger';
}

// ── Sub-components ────────────────────────────────────────────────────────

function TestBar({ passed, total }: { passed: number; total: number }) {
  const theme = useTheme();
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const color =
    pct >= 100 ? theme.colors.success : pct > 0 ? theme.colors.warning : theme.colors.danger;
  return (
    <TestBarWrap>
      <TestBarTrack>
        <TestBarFill style={{ width: `${pct}%`, background: color }} />
      </TestBarTrack>
      <TestBarLabel style={{ color: color }}>
        {passed}/{total}
      </TestBarLabel>
    </TestBarWrap>
  );
}

interface ProblemCardProps {
  problem: Problem;
  session: SolveSession | null;
  result: GradingResult | null;
}

function ProblemCard({ problem, session, result }: ProblemCardProps) {
  const status = getProblemStatus(session, result);
  const { label, tone } = STATUS_CONFIG[status];

  return (
    <Card href={`/solve/${problem.id}`}>
      <CardTop>
        <CardTitle>{problem.title}</CardTitle>
        <Badge tone={tone}>{label}</Badge>
      </CardTop>

      {result && result.totalCount > 0 ? (
        <TestBar passed={result.passedCount} total={result.totalCount} />
      ) : status === 'attempted' ? (
        <CardHint>채점을 실행해 결과를 기록하세요</CardHint>
      ) : null}

      {session ? (
        <CardMeta>
          <MetaItem>{session.languageId}</MetaItem>
          <MetaDot />
          <MetaItem>Q {session.questionsUsed}</MetaItem>
          <MetaDot />
          <MetaItem>{formatTokens(session.tokensUsed)} tok</MetaItem>
          {result && (
            <>
              <MetaDot />
              <MetaItem>{formatRelativeTime(result.submittedAt)}</MetaItem>
            </>
          )}
        </CardMeta>
      ) : (
        <CardMeta>
          <MetaItem style={{ fontStyle: 'italic' }}>아직 시도하지 않았습니다</MetaItem>
        </CardMeta>
      )}
    </Card>
  );
}

interface SubmissionRowProps {
  challengeTitle: string;
  challengeId: string;
  submission: StoredSubmission;
}

function SubmissionRow({ challengeTitle, challengeId, submission }: SubmissionRowProps) {
  const { finalScore, autoTest, submittedAt } = submission.result;
  return (
    <SubRow>
      <SubChallenge href={`/workspace/${challengeId}`}>{challengeTitle}</SubChallenge>
      <SubScore>
        <Badge tone={scoreTone(finalScore)}>{finalScore.toFixed(0)}점</Badge>
      </SubScore>
      <SubTest>
        <TestBar passed={autoTest.passedCount} total={autoTest.totalCount} />
      </SubTest>
      <SubMeta>
        <span>{submission.studentName || '익명'}</span>
        <MetaDot />
        <span>{formatRelativeTime(submittedAt)}</span>
        {submission.aiUsage && (
          <>
            <MetaDot />
            <span>Q {submission.aiUsage.questionsUsed}</span>
          </>
        )}
      </SubMeta>
    </SubRow>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function MyPageView() {
  const hasMounted = useHasMounted();
  const { data: currentUser } = useCurrentUser();

  const problems = useProblemStore((state) => state.problems);
  const sessions = useSolveSessionStore((state) => state.sessions);
  const gradingResults = useSolveHistoryStore((state) => state.results);
  const challenges = useChallengeStore((state) => state.challenges);
  const allSubmissions = useSubmissionStore((state) => state.submissions);

  // 문제별 상태 계산
  const problemItems = problems.map((problem) => {
    const session = sessions[problem.id] ?? null;
    const result = gradingResults[problem.id] ?? null;
    return { problem, session, result, status: getProblemStatus(session, result) };
  });

  const sortedProblems = [...problemItems].sort(
    (a, b) => STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order,
  );

  // 모든 제출을 최신순 정렬
  const challengeMap = Object.fromEntries(challenges.map((c) => [c.id, c]));
  const allSubmissionEntries = Object.entries(allSubmissions)
    .flatMap(([challengeId, subs]) =>
      subs.map((submission) => ({ challengeId, submission })),
    )
    .sort((a, b) => b.submission.result.submittedAt - a.submission.result.submittedAt);

  // 통계 계산
  const triedCount = problemItems.filter(({ session }) => session !== null).length;
  const passedCount = problemItems.filter(({ status }) => status === 'passed').length;
  const totalSubmissions = allSubmissionEntries.length;
  const avgScore =
    totalSubmissions > 0
      ? allSubmissionEntries.reduce(
          (sum, { submission }) => sum + submission.result.finalScore,
          0,
        ) / totalSubmissions
      : null;

  const totalAlgoQuestions = problems.reduce(
    (sum, p) => sum + (sessions[p.id]?.questionsUsed ?? 0),
    0,
  );
  const totalAlgoTokens = problems.reduce(
    (sum, p) => sum + (sessions[p.id]?.tokensUsed ?? 0),
    0,
  );
  const totalChallengeQuestions = allSubmissionEntries.reduce(
    (sum, { submission }) => sum + (submission.aiUsage?.questionsUsed ?? 0),
    0,
  );
  const totalChallengeTokens = allSubmissionEntries.reduce(
    (sum, { submission }) => sum + (submission.aiUsage?.tokensUsed ?? 0),
    0,
  );
  const totalQuestions = totalAlgoQuestions + totalChallengeQuestions;
  const totalTokens = totalAlgoTokens + totalChallengeTokens;

  return (
    <DesktopWrapper>
      <Navbar activeTitle="마이페이지" />
      <ContentContainer>
        <Main>
          {!hasMounted ? (
            <LoadingMsg>불러오는 중…</LoadingMsg>
          ) : (
            <>
              <StatBar>
                <StatCard>
                  <StatValue>
                    {triedCount}
                    <StatSub>/{problems.length}</StatSub>
                  </StatValue>
                  <StatLabel>알고리즘 시도</StatLabel>
                </StatCard>
                <StatCard $highlight="success">
                  <StatValue $tone="success">{passedCount}</StatValue>
                  <StatLabel>완전 통과</StatLabel>
                </StatCard>
                <StatCard>
                  <StatValue>{totalSubmissions}</StatValue>
                  <StatLabel>
                    웹 문제 제출
                    {avgScore !== null && (
                      <StatSubLabel> · 평균 {avgScore.toFixed(0)}점</StatSubLabel>
                    )}
                  </StatLabel>
                </StatCard>
                <StatCard>
                  <StatValue>{totalQuestions}회</StatValue>
                  <StatLabel>AI 질문 · {formatTokens(totalTokens)} 토큰</StatLabel>
                </StatCard>
              </StatBar>

              <Section>
                <SectionTitle>
                  알고리즘 문제
                  <SectionCount>{problems.length}개</SectionCount>
                </SectionTitle>
                {problems.length === 0 ? (
                  <EmptyMsg>출제된 알고리즘 문제가 없습니다.</EmptyMsg>
                ) : (
                  <ProblemGrid>
                    {sortedProblems.map(({ problem, session, result }) => (
                      <ProblemCard
                        key={problem.id}
                        problem={problem}
                        session={session}
                        result={result}
                      />
                    ))}
                  </ProblemGrid>
                )}
              </Section>

              <Section>
                <SectionTitle>
                  웹 문제 제출 이력
                  <SectionCount>{totalSubmissions}건</SectionCount>
                </SectionTitle>
                {allSubmissionEntries.length === 0 ? (
                  <EmptyMsg>제출한 웹 문제가 없습니다.</EmptyMsg>
                ) : (
                  <SubmissionTable>
                    <SubHeader>
                      <span>문제</span>
                      <span>점수</span>
                      <span>테스트</span>
                      <span>제출 정보</span>
                    </SubHeader>
                    {allSubmissionEntries.map(({ challengeId, submission }) => (
                      <SubmissionRow
                        key={submission.id}
                        challengeTitle={
                          challengeMap[challengeId]?.title ?? `(삭제된 문제)`
                        }
                        challengeId={challengeId}
                        submission={submission}
                      />
                    ))}
                  </SubmissionTable>
                )}
              </Section>
            </>
          )}
        </Main>
      </ContentContainer>
    </DesktopWrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Main = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`;

const PageHeader = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;
  flex-shrink: 0;
  &:hover { color: ${({ theme }) => theme.colors.text}; }
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
  color: ${({ theme }) => theme.colors.text};
  flex: 1;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
`;

const RoleTag = styled.span`
  padding: 2px ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.info};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const LoadingMsg = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
`;

// ── 통계 바 ────────────────────────────────────────────────────────────────

const StatBar = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StatCard = styled.div<{ $highlight?: 'success' | 'danger' }>`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};

  ${({ theme, $highlight }) =>
    $highlight &&
    css`
      border-color: ${$highlight === 'success' ? theme.colors.success : theme.colors.danger}44;
      background: ${$highlight === 'success' ? theme.colors.success : theme.colors.danger}0a;
    `}
`;

const StatValue = styled.div<{ $tone?: 'success' | 'danger' | 'info' }>`
  font-size: 28px;
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $tone }) =>
    $tone === 'success'
      ? theme.colors.success
      : $tone === 'danger'
        ? theme.colors.danger
        : $tone === 'info'
          ? theme.colors.info
          : theme.colors.text};
  line-height: 1;
`;

const StatSub = styled.span`
  font-size: ${({ theme }) => theme.font.sizeMd};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: ${({ theme }) => theme.font.weightRegular};
`;

const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const StatSubLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
`;

// ── 섹션 ────────────────────────────────────────────────────────────────────

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const SectionCount = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightRegular};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const EmptyMsg = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

// ── 알고리즘 문제 그리드 ────────────────────────────────────────────────────

const ProblemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const Card = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  text-decoration: none;
  transition: border-color 0.15s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CardTitle = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  flex: 1;
  word-break: break-word;
`;

const CardHint = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  flex-wrap: wrap;
`;

const MetaItem = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const MetaDot = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.border};
  &::before { content: '·'; }
`;

// ── 테스트 바 ────────────────────────────────────────────────────────────────

const TestBarWrap = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const TestBarTrack = styled.div`
  flex: 1;
  height: 4px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
`;

const TestBarFill = styled.div`
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
`;

const TestBarLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  min-width: 32px;
  text-align: right;
`;

// ── 과제 제출 테이블 ────────────────────────────────────────────────────────

const SubmissionTable = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

const SubHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 160px 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: ${({ theme }) => theme.font.weightBold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const SubRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 160px 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

const SubChallenge = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
  text-decoration: none;
  font-weight: ${({ theme }) => theme.font.weightBold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const SubScore = styled.div`
  display: flex;
  justify-content: center;
`;

const SubTest = styled.div`
  min-width: 0;
`;

const SubMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  flex-wrap: wrap;
`;

const DesktopWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: ${({ theme }) => theme.colors.background};
`;

const ContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;
