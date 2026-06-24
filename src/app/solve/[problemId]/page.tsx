/**
 * page.tsx (/solve/[problemId]) — 학생 풀이 화면 진입점
 *
 * URL의 problemId로 문제를 찾아 SolveView를 렌더한다. 문제 데이터는
 * localStorage 기반 스토어에서 오므로 마운트 이후에 조회한다. 문제를 찾지
 * 못하면 안내 + 홈 링크를 보여준다. 라우팅 진입점 역할만 한다.
 *
 * 사용처: Next.js App Router '/solve/[problemId]' 경로
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import styled from 'styled-components';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { PageShell } from '@/shared/components/ui/PageShell';
import { SolveView } from '@/features/solve/SolveView';

export default function SolvePage() {
  const params = useParams<{ problemId: string }>();
  const hasMounted = useHasMounted();
  const problem = useProblemStore((state) =>
    state.problems.find((item) => item.id === params.problemId),
  );

  if (!hasMounted) {
    return (
      <PageShell>
        <Notice>불러오는 중…</Notice>
      </PageShell>
    );
  }

  if (!problem) {
    return (
      <PageShell>
        <Notice>
          문제를 찾을 수 없습니다. <Link href="/">홈으로 돌아가기</Link>
        </Notice>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SolveView problem={problem} />
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
