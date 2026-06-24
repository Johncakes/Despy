/**
 * page.tsx (/author) — 교수 출제 화면 진입점
 *
 * AuthorView를 전체 높이 셸 안에 렌더한다. 문제 데이터는 localStorage 기반
 * 스토어에서 오므로 마운트 이후에 렌더한다(hydration mismatch 방지). 라우팅
 * 진입점 역할만 하고 로직은 feature(AuthorView)에 둔다.
 *
 * 사용처: Next.js App Router '/author' 경로
 */
'use client';

import styled from 'styled-components';
import { AuthorView } from '@/features/author/AuthorView';
import { PageShell } from '@/shared/components/ui/PageShell';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';

export default function AuthorPage() {
  const hasMounted = useHasMounted();

  return (
    <PageShell>
      {hasMounted ? <AuthorView /> : <Loading>불러오는 중…</Loading>}
    </PageShell>
  );
}

const Loading = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
`;
