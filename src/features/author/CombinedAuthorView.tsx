/**
 * CombinedAuthorView.tsx — 교수 문제 출제 통합 관리 화면 (웹 + 알고리즘)
 *
 * 하나의 리스트에서 웹과 알고리즘 유형의 문제를 모두 확인하고 출제/편집할 수 있다.
 * 새 문제를 출제할 때 유형을 먼저 선택해야 상세 설정 폼이 활성화되도록 구성되었다.
 *
 * 사용처: app/author/page.tsx
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type { ChallengeProblem, Problem } from '@/shared/core/types';
import { useChallengeStore } from '@/shared/core/stores/challengeStore';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { UnifiedProblemForm } from '@/features/author/components/UnifiedProblemForm';

export function CombinedAuthorView() {
  // ── Stores ──────────────────────────────────────────────────────────────
  const challenges = useChallengeStore((state) => state.challenges);
  const upsertChallenge = useChallengeStore((state) => state.upsertChallenge);
  const deleteChallenge = useChallengeStore((state) => state.deleteChallenge);

  const problems = useProblemStore((state) => state.problems);
  const upsertProblem = useProblemStore((state) => state.upsertProblem);
  const deleteProblem = useProblemStore((state) => state.deleteProblem);

  // ── Editing State ────────────────────────────────────────────────────────
  // editingId: string | null. null이면 새 문제 출제 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'web' | 'algo' | null>(null);

  // 현재 편집 대상 찾기
  const editingProblem =
    editingId && editingType
      ? editingType === 'web'
        ? (challenges.find((c) => c.id === editingId) ?? null)
        : (problems.find((p) => p.id === editingId) ?? null)
      : null;

  // 모든 문제 통합 목록 구성 (최신 수정 또는 등록 순 정렬)
  const allItems = [
    ...challenges.map((c) => ({
      id: c.id,
      title: c.title,
      type: 'web' as const,
      createdAt: c.createdAt || 0,
    })),
    ...problems.map((p) => ({
      id: p.id,
      title: p.title,
      type: 'algo' as const,
      createdAt: p.createdAt || 0,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = (type: 'web' | 'algo', problem: ChallengeProblem | Problem) => {
    if (type === 'web') {
      upsertChallenge(problem as ChallengeProblem);
    } else {
      upsertProblem(problem as Problem);
    }
    setEditingId(problem.id);
    setEditingType(type);
  };

  const handleDelete = () => {
    if (!editingId || !editingType) return;
    if (editingType === 'web') {
      deleteChallenge(editingId);
    } else {
      deleteProblem(editingId);
    }
    setEditingId(null);
    setEditingType(null);
  };

  const handleStartNew = () => {
    setEditingId(null);
    setEditingType(null);
  };

  return (
    <Layout>
      <Sidebar>
        <Panel
          title="문제 목록"
          actions={
            <Button variant="primary" onClick={handleStartNew}>
              + 새 문제
            </Button>
          }
        >
          <List>
            {allItems.map((item) => (
              <ListItem key={item.id} $active={item.id === editingId}>
                <ItemButton
                  type="button"
                  $active={item.id === editingId}
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingType(item.type);
                  }}
                >
                  <TypeBadge $type={item.type}>
                    {item.type === 'web' ? '웹' : '알고'}
                  </TypeBadge>
                  <ItemTitle $active={item.id === editingId}>
                    {item.title || '(제목 없음)'}
                  </ItemTitle>
                </ItemButton>
                <SolveLink href={item.type === 'web' ? `/workspace/${item.id}` : `/solve/${item.id}`}>
                  풀기 →
                </SolveLink>
              </ListItem>
            ))}
            {allItems.length === 0 && <Empty>출제된 문제가 없습니다.</Empty>}
          </List>
        </Panel>
      </Sidebar>

      <Content>
        <Panel
          title={editingProblem ? '문제 편집' : '새 문제 출제'}
          actions={
            editingType === 'web' && editingId ? (
              <DashboardLink href={`/author/challenge/${editingId}/submissions`}>
                채점 현황 →
              </DashboardLink>
            ) : undefined
          }
        >
          <UnifiedProblemForm
            key={editingId ?? 'new'}
            initialType={editingType}
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
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
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
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ListItem = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $active }) =>
    $active ? `${theme.colors.primary}0a` : theme.colors.surfaceAlt};
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme, $active }) =>
      $active ? `${theme.colors.primary}0f` : theme.colors.surface};
  }
`;

const ItemButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  min-width: 0;
`;

const ItemTitle = styled.span<{ $active?: boolean }>`
  flex: 1;
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme, $active }) =>
    $active ? theme.font.weightBold : theme.font.weightRegular};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TypeBadge = styled.span<{ $type: 'web' | 'algo' }>`
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  background: ${({ theme, $type }) =>
    $type === 'web' ? `${theme.colors.info}15` : `${theme.colors.primary}15`};
  color: ${({ theme, $type }) =>
    $type === 'web' ? theme.colors.info : theme.colors.primary};
  border: 1px solid
    ${({ theme, $type }) =>
      $type === 'web' ? `${theme.colors.info}33` : `${theme.colors.primary}33`};
`;

const SolveLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
  flex-shrink: 0;
`;

const DashboardLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
