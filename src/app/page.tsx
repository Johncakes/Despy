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
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { Button } from '@/shared/components/ui/Button';
import { Panel } from '@/shared/components/ui/Panel';

export default function HomePage() {
  const hasMounted = useHasMounted();
  const challenges = useChallengeStore((state) => state.challenges);
  const problems = useProblemStore((state) => state.problems);

  return (
    <Main>
      <Header>
        <Title>despy</Title>
        <Subtitle>에이전틱 코딩 평가 시스템 — 통제된 AI로 알고리즘 문제 풀기</Subtitle>
        <HeaderActions>
          <Link href="/author/challenge">
            <Button variant="primary">교수 모드 — 과제 출제</Button>
          </Link>
          <Link href="/author">
            <Button variant="ghost">알고리즘 문제 출제</Button>
          </Link>
          <Link href="/playground">
            <Button variant="ghost">WebContainer PoC →</Button>
          </Link>
        </HeaderActions>
      </Header>

      <ListWrap>
        <Panel title="과제 목록 (워크스페이스 — 실시간 바이브코딩)">
          <List>
            {!hasMounted && <Empty>불러오는 중…</Empty>}
            {hasMounted &&
              challenges.map((challenge) => (
                <Row key={challenge.id}>
                  <RowTitle>{challenge.title || '(제목 없음)'}</RowTitle>
                  <Link href={`/workspace/${challenge.id}`}>
                    <Button variant="primary">풀기 →</Button>
                  </Link>
                </Row>
              ))}
            {hasMounted && challenges.length === 0 && (
              <Empty>출제된 과제가 없습니다.</Empty>
            )}
          </List>
        </Panel>
      </ListWrap>

      <ListWrap>
        <Panel title="알고리즘 문제 (AI 채점)">
          <List>
            {!hasMounted && <Empty>불러오는 중…</Empty>}
            {hasMounted &&
              problems.map((problem) => (
                <Row key={problem.id}>
                  <RowTitle>{problem.title || '(제목 없음)'}</RowTitle>
                  <Link href={`/solve/${problem.id}`}>
                    <Button variant="ghost">풀기 →</Button>
                  </Link>
                </Row>
              ))}
            {hasMounted && problems.length === 0 && (
              <Empty>출제된 문제가 없습니다. 교수 모드에서 문제를 추가하세요.</Empty>
            )}
          </List>
        </Panel>
      </ListWrap>
    </Main>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Main = styled.main`
  min-height: 100vh;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.xl};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h1`
  margin: 0;
  font-size: 48px;
  color: ${({ theme }) => theme.colors.primary};
`;

const Subtitle = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ListWrap = styled.div`
  height: 360px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const RowTitle = styled.span`
  font-size: ${({ theme }) => theme.font.sizeMd};
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
