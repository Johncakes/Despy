/**
 * page.tsx (/author/challenge/[challengeId]/submissions) — 교수 채점 대시보드 진입점
 *
 * URL의 challengeId로 과제를 찾아 GradingDashboardView를 렌더한다. 과제 데이터는
 * localStorage 기반 challengeStore에서 오므로 마운트 이후에 조회한다. 과제를 찾지
 * 못하면 안내 + 출제 화면 링크를 보여준다. 라우팅 진입점 역할만 한다.
 *
 * 사용처: Next.js App Router '/author/challenge/[challengeId]/submissions' 경로
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import styled from 'styled-components';
import { useChallengeStore } from '@/shared/core/stores/challengeStore';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { Navbar } from '@/shared/components/ui/Navbar';
import { GradingDashboardView } from '@/features/author/GradingDashboardView';

export default function GradingDashboardPage() {
  const params = useParams<{ challengeId: string }>();
  const hasMounted = useHasMounted();
  const challenge = useChallengeStore((state) =>
    state.challenges.find((item) => item.id === params.challengeId),
  );

  if (!hasMounted) {
    return (
      <DesktopWrapper>
        <Navbar activeTitle="채점 현황" />
        <ContentContainer>
          <Notice>불러오는 중…</Notice>
        </ContentContainer>
      </DesktopWrapper>
    );
  }

  if (!challenge) {
    return (
      <DesktopWrapper>
        <Navbar activeTitle="채점 현황" />
        <ContentContainer>
          <Notice>
            문제를 찾을 수 없습니다. <Link href="/author">문제 출제로 돌아가기</Link>
          </Notice>
        </ContentContainer>
      </DesktopWrapper>
    );
  }

  return (
    <DesktopWrapper>
      <Navbar activeTitle="채점 현황" />
      <ContentContainer>
        <GradingDashboardView challenge={challenge} />
      </ContentContainer>
    </DesktopWrapper>
  );
}

const DesktopWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: ${({ theme }) => theme.colors.background};
`;

const ContentContainer = styled.div`
  flex: 1;
  min-height: 0;
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
`;

const Notice = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.md};

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: underline;
  }
`;
