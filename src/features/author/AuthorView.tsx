/**
 * AuthorView.tsx — 교수 출제 화면 (문제 목록 + 편집 폼)
 *
 * 좌측에 출제된 문제 목록을, 우측에 선택한 문제의 편집 폼을 보여준다. 문제는
 * problemStore(localStorage)에 저장되며 학생 풀이 화면이 같은 출처를 읽는다.
 * 각 문제에서 바로 풀이 화면(/solve/[id])으로 이동할 수 있다.
 *
 * 사용처: app/author/page.tsx
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type { Problem } from '@/shared/core/types';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { ProblemForm } from '@/features/author/components/ProblemForm';

// ── Component ─────────────────────────────────────────────────────────────

export function AuthorView() {
  const problems = useProblemStore((state) => state.problems);
  const upsertProblem = useProblemStore((state) => state.upsertProblem);
  const deleteProblem = useProblemStore((state) => state.deleteProblem);

  // null = 새 문제 출제 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingProblem = editingId
    ? (problems.find((problem) => problem.id === editingId) ?? null)
    : null;

  const handleSubmit = (problem: Problem) => {
    upsertProblem(problem);
    setEditingId(problem.id);
  };

  const handleDelete = () => {
    if (!editingId) return;
    deleteProblem(editingId);
    setEditingId(null);
  };

  return (
    <Layout>
      <Sidebar>
        <Panel
          title="문제 목록"
          actions={
            <Button variant="primary" onClick={() => setEditingId(null)}>
              + 새 문제
            </Button>
          }
        >
          <List>
            {problems.map((problem) => (
              <ListItem key={problem.id} $active={problem.id === editingId}>
                <ItemButton
                  type="button"
                  onClick={() => setEditingId(problem.id)}
                >
                  {problem.title || '(제목 없음)'}
                </ItemButton>
                <SolveLink href={`/solve/${problem.id}`}>풀기 →</SolveLink>
              </ListItem>
            ))}
            {problems.length === 0 && <Empty>출제된 문제가 없습니다.</Empty>}
          </List>
        </Panel>
      </Sidebar>

      <Content>
        <Panel title={editingProblem ? '문제 편집' : '새 문제 출제'}>
          <ProblemForm
            key={editingId ?? 'new'}
            initialProblem={editingProblem}
            onSubmit={handleSubmit}
            onDelete={editingProblem ? handleDelete : undefined}
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
