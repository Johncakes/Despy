/**
 * ChallengeAuthorView.tsx — 교수 과제 출제 화면 (과제 목록 + 편집 폼)
 *
 * 좌측에 출제된 과제 목록을, 우측에 선택한 과제의 편집 폼을 보여준다. 과제는
 * challengeStore(localStorage 'despy-challenges')에 저장되며 학생 워크스페이스
 * 화면(/workspace/[id])이 같은 출처를 읽는다. 각 과제에서 바로 풀이 화면으로
 * 이동할 수 있다. (WebContainer 피벗 — 구 알고리즘 AuthorView 대응물)
 *
 * 사용처: app/author/challenge/page.tsx
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type { ChallengeProblem } from '@/shared/core/types';
import { useChallengeStore } from '@/shared/core/stores/challengeStore';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { ChallengeForm } from '@/features/author/components/ChallengeForm';

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeAuthorView() {
  const challenges = useChallengeStore((state) => state.challenges);
  const upsertChallenge = useChallengeStore((state) => state.upsertChallenge);
  const deleteChallenge = useChallengeStore((state) => state.deleteChallenge);

  // null = 새 과제 출제 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingChallenge = editingId
    ? (challenges.find((challenge) => challenge.id === editingId) ?? null)
    : null;

  const handleSubmit = (challenge: ChallengeProblem) => {
    upsertChallenge(challenge);
    setEditingId(challenge.id);
  };

  const handleDelete = () => {
    if (!editingId) return;
    deleteChallenge(editingId);
    setEditingId(null);
  };

  return (
    <Layout>
      <Sidebar>
        <Panel
          title="과제 목록"
          actions={
            <Button variant="primary" onClick={() => setEditingId(null)}>
              + 새 과제
            </Button>
          }
        >
          <List>
            {challenges.map((challenge) => (
              <ListItem key={challenge.id} $active={challenge.id === editingId}>
                <ItemButton type="button" onClick={() => setEditingId(challenge.id)}>
                  {challenge.title || '(제목 없음)'}
                </ItemButton>
                <SolveLink href={`/workspace/${challenge.id}`}>풀기 →</SolveLink>
              </ListItem>
            ))}
            {challenges.length === 0 && <Empty>출제된 과제가 없습니다.</Empty>}
          </List>
        </Panel>
      </Sidebar>

      <Content>
        <Panel title={editingChallenge ? '과제 편집' : '새 과제 출제'}>
          <ChallengeForm
            key={editingId ?? 'new'}
            initialChallenge={editingChallenge}
            onSubmit={handleSubmit}
            onDelete={editingChallenge ? handleDelete : undefined}
          />
        </Panel>
      </Content>
    </Layout>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Layout = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  height: 100%;
  min-height: 0;
`;

const Sidebar = styled.div`
  min-height: 0;
`;

const Content = styled.div`
  min-height: 0;
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ListItem = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.surfaceAlt : 'transparent'};
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
`;

const ItemButton = styled.button`
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.font.sizeSm};
  cursor: pointer;
  padding: 0;
`;

const SolveLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
