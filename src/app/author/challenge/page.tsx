/**
 * page.tsx (/author/challenge) — 교수 과제 출제 화면 진입점 (WebContainer 피벗)
 *
 * ChallengeAuthorView를 전체 높이 셸 안에 렌더한다. 과제 데이터는 localStorage
 * 기반 challengeStore에서 오므로 마운트 이후에 렌더한다(hydration mismatch 방지).
 * 라우팅 진입점 역할만 하고 로직은 feature(ChallengeAuthorView)에 둔다.
 *
 * (구 /author는 알고리즘 출제 화면으로 유지 — 피벗 완료 후 P5에서 정리.)
 *
 * 사용처: Next.js App Router '/author/challenge' 경로
 */
'use client';

import styled from 'styled-components';
import { ChallengeAuthorView } from '@/features/author/ChallengeAuthorView';
import { PageShell } from '@/shared/components/ui/PageShell';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';

export default function ChallengeAuthorPage() {
  const hasMounted = useHasMounted();

  return (
    <PageShell>
      {hasMounted ? <ChallengeAuthorView /> : <Loading>불러오는 중…</Loading>}
    </PageShell>
  );
}

const Loading = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
`;
