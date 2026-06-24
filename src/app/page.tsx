/**
 * page.tsx — 홈 (역할 진입 + 문제 목록)
 *
 * 교수 모드(/author)로 가거나, 출제된 문제를 골라 풀이 화면(/solve/[id])으로
 * 진입하는 시작 화면. 문제 목록은 problemStore(localStorage)에서 읽으므로
 * 마운트 이후에 렌더한다. 도메인 로직은 두지 않고 라우팅 진입점 역할만 한다.
 *
 * 사용처: Next.js App Router '/' 경로
 */
'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { useChallengeStore } from '@/shared/core/stores/challengeStore';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { useCurrentUser, useLogout } from '@/shared/core/queries/authQueries';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { Button } from '@/shared/components/ui/Button';
import { Panel } from '@/shared/components/ui/Panel';

export default function HomePage() {
  const hasMounted = useHasMounted();
  const challenges = useChallengeStore((state) => state.challenges);
  const problems = useProblemStore((state) => state.problems);
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();

  const isAuthor = currentUser?.role === 'professor' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <DesktopWrapper>
      <Navbar>
        <NavBrand>
          <Logo>despy</Logo>
          <BrandDivider />
          <NavTitle>Dashboard</NavTitle>
        </NavBrand>
        <NavActions>
          {hasMounted && currentUser && (
            <UserTag>
              {currentUser.name}
              <RoleTag $role={currentUser.role}>
                {currentUser.role === 'admin'
                  ? '관리자'
                  : currentUser.role === 'professor'
                    ? '교수'
                    : '학생'}
              </RoleTag>
            </UserTag>
          )}
          {isAuthor && (
            <Link href="/author/challenge">
              <Button variant="primary">과제 출제</Button>
            </Link>
          )}
          {hasMounted && currentUser ? (
            <Button variant="ghost" onClick={() => logout.mutate()}>
              로그아웃
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="primary">로그인</Button>
            </Link>
          )}
        </NavActions>
      </Navbar>

      <DashboardContainer>
        <MainPanel>
          <DashboardSection>
            <SectionHeader>
              <SectionTitle>실무형 웹 과제 (Vibe Coding)</SectionTitle>
              <SectionDesc>브라우저 내 WebContainer 가상 환경에서 실시간 빌드·실행 및 AI 정성 채점을 평가합니다.</SectionDesc>
            </SectionHeader>
            <ItemGrid>
              {!hasMounted && <LoadingText>과제를 불러오는 중…</LoadingText>}
              {hasMounted && challenges.map((challenge) => (
                <ChallengeCard key={challenge.id}>
                  <CardMeta>
                    <TypeBadge $type="web">WEB</TypeBadge>
                    <ModelName>{challenge.aiPolicy.model}</ModelName>
                  </CardMeta>
                  <CardTitle>{challenge.title || '(제목 없음)'}</CardTitle>
                  <CardFooter>
                    <QuotaInfo>
                      질문 {challenge.aiPolicy.maxQuestions}회 / {challenge.aiPolicy.maxTokens} 토큰 한도
                    </QuotaInfo>
                    <Link href={`/workspace/${challenge.id}`}>
                      <ActionButton variant="primary">풀기 →</ActionButton>
                    </Link>
                  </CardFooter>
                </ChallengeCard>
              ))}
              {hasMounted && challenges.length === 0 && (
                <EmptyState>출제된 과제가 없습니다.</EmptyState>
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

        <SidebarPanel>
          <SidebarWidget>
            <WidgetTitle>사용자 프로필</WidgetTitle>
            {hasMounted && currentUser ? (
              <ProfileContent>
                <Avatar>{currentUser.name[0]?.toUpperCase()}</Avatar>
                <ProfileInfo>
                  <ProfileName>{currentUser.name}</ProfileName>
                  <ProfileEmail>{currentUser.email}</ProfileEmail>
                </ProfileInfo>
              </ProfileContent>
            ) : (
              <ProfilePlaceholder>로그인이 필요합니다.</ProfilePlaceholder>
            )}
            <WidgetActions>
              <Link href="/mypage" style={{ width: '100%' }}>
                <FullWidthButton variant="ghost">마이페이지</FullWidthButton>
              </Link>
            </WidgetActions>
          </SidebarWidget>

          <SidebarWidget>
            <WidgetTitle>교수 출제 가이드</WidgetTitle>
            <GuideList>
              <GuideItem>
                <strong>과제 출제</strong>: Vite+React 템플릿과 Vitest 채점 코드를 제공하여 복잡한 웹 과제를 빌드하고, AI 채점 루브릭을 관리합니다.
              </GuideItem>
              <GuideItem>
                <strong>알고리즘 출제</strong>: Monaco 에디터 기반 풀이 환경 및 AI 정적 추론 채점 쿼터를 지정합니다.
              </GuideItem>
            </GuideList>
            <WidgetActions>
              {isAuthor && (
                <>
                  <Link href="/author" style={{ width: '100%' }}>
                    <FullWidthButton variant="ghost">알고리즘 출제 관리</FullWidthButton>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin/users" style={{ width: '100%' }}>
                      <FullWidthButton variant="ghost">사용자 계정 관리</FullWidthButton>
                    </Link>
                  )}
                </>
              )}
              <Link href="/playground" style={{ width: '100%' }}>
                <FullWidthButton variant="ghost">WebContainer 놀이터</FullWidthButton>
              </Link>
            </WidgetActions>
          </SidebarWidget>
        </SidebarPanel>
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

const Navbar = styled.header`
  height: 50px;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  flex-shrink: 0;
  z-index: 10;
`;

const NavBrand = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Logo = styled.span`
  font-size: 20px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: -0.5px;
`;

const BrandDivider = styled.div`
  width: 1px;
  height: 16px;
  background: ${({ theme }) => theme.colors.border};
`;

const NavTitle = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const UserTag = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const RoleTag = styled.span<{ $role: string }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 800;
  background: ${({ theme, $role }) =>
    $role === 'admin'
      ? `${theme.colors.danger}15`
      : $role === 'professor'
        ? `${theme.colors.primary}15`
        : `${theme.colors.success}15`};
  color: ${({ theme, $role }) =>
    $role === 'admin'
      ? theme.colors.danger
      : $role === 'professor'
        ? theme.colors.primary
        : theme.colors.success};
  border: 1px solid ${({ theme, $role }) =>
    $role === 'admin'
      ? `${theme.colors.danger}33`
      : $role === 'professor'
        ? `${theme.colors.primary}33`
        : `${theme.colors.success}33`};
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

const SidebarPanel = styled.aside`
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
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

const SidebarWidget = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
`;

const WidgetTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
`;

const ProfileContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Avatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: ${({ theme }) => theme.colors.primary}20;
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 20px;
  border: 2px solid ${({ theme }) => theme.colors.primary}50;
`;

const ProfileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ProfileName = styled.span`
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const ProfileEmail = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ProfilePlaceholder = styled.div`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  padding: ${({ theme }) => theme.spacing.sm} 0;
`;

const WidgetActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const FullWidthButton = styled(Button)`
  width: 100%;
  justify-content: center;
`;

const GuideList = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const GuideItem = styled.li`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.5;

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;
