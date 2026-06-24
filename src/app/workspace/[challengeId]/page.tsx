/**
 * page.tsx (/workspace/[challengeId]) — 학생 과제 풀이(워크스페이스) 진입점
 *
 * URL의 challengeId로 과제(학생 DTO, StudentChallenge)를 서버에서 조회해
 * ChallengeSolveView를 렌더한다. 과제 데이터는 더 이상 localStorage(challengeStore)가
 * 아니라 서버 Query(useChallengeForSolve)에서 오므로 로딩/실패/없음 상태를 처리한다.
 * 라우팅 진입점 역할만 한다.
 *
 * (구 /solve/[problemId]는 알고리즘 모델용으로 유지 — 피벗 완료 후 P5에서 정리.)
 *
 * 사용처: Next.js App Router '/workspace/[challengeId]' 경로
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import styled from 'styled-components';
import { useChallengeForSolve } from '@/shared/core/queries/challengeQueries';
import { PageShell } from '@/shared/components/ui/PageShell';
import { ChallengeSolveView } from '@/features/solve/ChallengeSolveView';

export default function WorkspacePage() {
  const params = useParams<{ challengeId: string }>();
  const { data: challenge, isLoading, isError } = useChallengeForSolve(
    params.challengeId,
  );

  if (isLoading) {
    return (
      <PageShell>
        <Notice>불러오는 중…</Notice>
      </PageShell>
    );
  }

  if (isError || !challenge) {
    return (
      <PageShell>
        <Notice>
          과제를 찾을 수 없습니다. <Link href="/">홈으로 돌아가기</Link>
        </Notice>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ChallengeSolveView challenge={challenge} />
    </PageShell>
  );
}

const Notice = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: underline;
  }
`;
