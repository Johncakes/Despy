/**
 * page.tsx (/workspace/[challengeId]) — 학생 과제 풀이(워크스페이스) 진입점
 *
 * URL의 challengeId로 과제를 찾아 ChallengeSolveView를 렌더한다. 과제 데이터는
 * localStorage 기반 challengeStore에서 오므로 마운트 이후에 조회한다. 과제를 찾지
 * 못하면 안내 + 홈 링크를 보여준다. 라우팅 진입점 역할만 한다.
 *
 * (구 /solve/[problemId]는 알고리즘 모델용으로 유지 — 피벗 완료 후 P5에서 정리.)
 *
 * 사용처: Next.js App Router '/workspace/[challengeId]' 경로
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import styled from 'styled-components';
import { useChallengeStore } from '@/shared/core/stores/challengeStore';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { PageShell } from '@/shared/components/ui/PageShell';
import { ChallengeSolveView } from '@/features/solve/ChallengeSolveView';

export default function WorkspacePage() {
  const params = useParams<{ challengeId: string }>();
  const hasMounted = useHasMounted();
  const challenge = useChallengeStore((state) =>
    state.challenges.find((item) => item.id === params.challengeId),
  );

  if (!hasMounted) {
    return (
      <PageShell>
        <Notice>불러오는 중…</Notice>
      </PageShell>
    );
  }

  if (!challenge) {
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
