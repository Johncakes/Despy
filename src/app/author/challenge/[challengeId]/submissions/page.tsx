/**
 * page.tsx (/author/challenge/[challengeId]/submissions) — 교수 채점 대시보드 진입점
 *
 * URL의 challengeId로 과제를 서버에서 조회해 GradingDashboardView를 렌더한다. 과제는
 * 출제자·admin만 접근 가능한 전체 ChallengeProblem(루브릭 포함)이며, 비소유 시 서버가
 * 403/404를 낸다. 조회 중·실패 상태를 안내하고, 라우팅 진입점 역할만 한다.
 *
 * 사용처: Next.js App Router '/author/challenge/[challengeId]/submissions' 경로
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import styled from 'styled-components';
import { useChallengeForEdit } from '@/shared/core/queries/challengeQueries';
import { Navbar } from '@/shared/components/ui/Navbar';
import { GradingDashboardView } from '@/features/author/GradingDashboardView';

export default function GradingDashboardPage() {
  const params = useParams<{ challengeId: string }>();
  const {
    data: challenge,
    isLoading,
    isError,
    error,
  } = useChallengeForEdit(params.challengeId);

  if (isLoading) {
    return (
      <DesktopWrapper>
        <Navbar activeTitle="채점 현황" />
        <ContentContainer>
          <Notice>불러오는 중…</Notice>
        </ContentContainer>
      </DesktopWrapper>
    );
  }

  if (isError || !challenge) {
    return (
      <DesktopWrapper>
        <Navbar activeTitle="채점 현황" />
        <ContentContainer>
          <Notice>
            {error?.message ?? '문제를 찾을 수 없습니다.'}{' '}
            <Link href="/author">문제 출제로 돌아가기</Link>
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
