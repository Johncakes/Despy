/**
 * page.tsx — 홈 (역할 진입 + 문제 목록)
 *
 * 교수 모드(/author)로 가거나, 출제된 문제를 골라 풀이 화면(/solve/[id])으로
 * 진입하는 시작 화면. 웹 문제 목록은 서버(useChallenges, 역할별 필터)에서 읽고,
 * 알고리즘 문제 목록은 problemStore(localStorage)에서 읽으므로 마운트 이후에 렌더한다.
 * 도메인 로직은 두지 않고 라우팅 진입점 역할만 한다.
 *
 * 사용처: Next.js App Router '/' 경로
 */
'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { useChallenges } from '@/shared/core/queries/challengeQueries';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { Button } from '@/shared/components/ui/Button';
import { Navbar } from '@/shared/components/ui/Navbar';

export default function HomePage() {
  const hasMounted = useHasMounted();
  const {
    data: challenges,
    isLoading: isChallengesLoading,
    isError: isChallengesError,
  } = useChallenges();
  const problems = useProblemStore((state) => state.problems);

  return (
    <DesktopWrapper>
      <Navbar activeTitle="Dashboard" />

      <DashboardContainer>
        <MainPanel>
          <DashboardSection>
            <SectionHeader>
              <SectionTitle>실무형 웹 문제 (Vibe Coding)</SectionTitle>
              <SectionDesc>브라우저 내 WebContainer 가상 환경에서 실시간 빌드·실행 및 AI 정성 채점을 평가합니다.</SectionDesc>
            </SectionHeader>
            <ItemGrid>
              {isChallengesLoading && <LoadingText>문제를 불러오는 중…</LoadingText>}
              {isChallengesError && (
                <EmptyState>웹 문제 목록을 불러오지 못했습니다.</EmptyState>
              )}
              {!isChallengesLoading && !isChallengesError && challenges?.map((challenge) => (
                <ChallengeCard key={challenge.id}>
                  <CardMeta>
                    <TypeBadge $type="web">WEB</TypeBadge>
                  </CardMeta>
                  <CardTitle>{challenge.title || '(제목 없음)'}</CardTitle>
                  <CardFooter>
                    <Link href={`/workspace/${challenge.id}`}>
                      <ActionButton variant="primary">풀기 →</ActionButton>
                    </Link>
                  </CardFooter>
                </ChallengeCard>
              ))}
              {!isChallengesLoading && !isChallengesError && challenges?.length === 0 && (
                <EmptyState>출제된 웹 문제가 없습니다.</EmptyState>
              )}
            </ItemGrid>
          </DashboardSection>

          <DashboardSection>
            <SectionHeader>
              <SectionTitle>알고리즘 문제 (AI 채점)</SectionTitle>
              <SectionDesc>AI가 작성 코드를 정밀 추론하여 실행 없이 테스트케이스 정답성을 판정합니다.</SectionDesc>
            </SectionHeader>
            <ItemGrid>
              {!hasMounted && <LoadingText>문제를 불러오는 중…</LoadingText>}
              {hasMounted && problems.map((problem) => (
                <ChallengeCard key={problem.id}>
                  <CardMeta>
                    <TypeBadge $type="algo">ALGO</TypeBadge>
                    <ModelName>{problem.aiPolicy.model}</ModelName>
                  </CardMeta>
                  <CardTitle>{problem.title || '(제목 없음)'}</CardTitle>
                  <CardFooter>
                    <QuotaInfo>
                      질문 {problem.aiPolicy.maxQuestions}회 / {problem.aiPolicy.maxTokens} 토큰 한도
                    </QuotaInfo>
                    <Link href={`/solve/${problem.id}`}>
                      <ActionButton variant="ghost">풀기 →</ActionButton>
                    </Link>
                  </CardFooter>
                </ChallengeCard>
              ))}
              {hasMounted && problems.length === 0 && (
                <EmptyState>출제된 알고리즘 문제가 없습니다.</EmptyState>
              )}
            </ItemGrid>
          </DashboardSection>
        </MainPanel>
      </DashboardContainer>
    </DesktopWrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const DesktopWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: ${({ theme }) => theme.colors.background};
`;

const NavLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  transition: all 0.15s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

const NavDivider = styled.div`
  width: 1px;
  height: 16px;
  background: ${({ theme }) => theme.colors.border};
`;

const DashboardContainer = styled.div`
  flex: 1;
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  min-height: 0;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
`;

const MainPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
`;

const DashboardSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const SectionDesc = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const ChallengeCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border-color: ${({ theme }) => theme.colors.primary}55;
  }
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TypeBadge = styled.span<{ $type: 'web' | 'algo' }>`
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${({ theme, $type }) =>
    $type === 'web' ? `${theme.colors.info}15` : `${theme.colors.primary}15`};
  color: ${({ theme, $type }) =>
    $type === 'web' ? theme.colors.info : theme.colors.primary};
`;

const ModelName = styled.span`
  font-size: 11px;
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.4;
  flex: 1;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: ${({ theme }) => theme.spacing.sm};
  gap: ${({ theme }) => theme.spacing.sm};
`;

const QuotaInfo = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ActionButton = styled(Button)`
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.font.sizeSm};
`;

const EmptyState = styled.div`
  grid-column: 1 / -1;
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
`;

const LoadingText = styled.div`
  grid-column: 1 / -1;
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
`;
