/**
 * CombinedAuthorView.tsx — 교수 문제 출제 통합 관리 화면 (웹 + 알고리즘)
 *
 * 하나의 리스트에서 웹과 알고리즘 유형의 문제를 모두 확인하고 출제/편집할 수 있다.
 * 웹 과제(ChallengeProblem)는 서버(/api/challenges)에 영속되며 TanStack Query 캐시가
 * 단일 출처다(challengeStore 대체 — M4). 알고리즘 문제(Problem)는 아직 problemStore
 * (localStorage)에 둔다. 새 문제를 출제할 때 유형을 먼저 선택해야 상세 설정 폼이
 * 활성화되도록 구성되었다.
 *
 * 사용처: app/author/page.tsx
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type {
  ChallengeInput,
  ChallengeProblem,
  Problem,
} from '@/shared/core/types';
import {
  useChallenges,
  useChallengeForEdit,
  useCreateChallenge,
  useUpdateChallenge,
  useDeleteChallenge,
} from '@/shared/core/queries/challengeQueries';
import { useProblemStore } from '@/shared/core/stores/problemStore';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { UnifiedProblemForm } from '@/features/author/components/UnifiedProblemForm';

// ── Helpers ───────────────────────────────────────────────────────────────

/** 폼이 만든 전체 과제 객체에서 서버가 채우는 필드를 떼어내 생성/수정 입력으로 만든다. */
function toChallengeInput(challenge: ChallengeProblem): ChallengeInput {
  const { id, authorId, status, createdAt, updatedAt, ...input } = challenge;
  void id;
  void authorId;
  void status;
  void createdAt;
  void updatedAt;
  return input;
}

// ── Component ─────────────────────────────────────────────────────────────

export function CombinedAuthorView() {
  // ── 서버 데이터(웹 과제) ───────────────────────────────────────────────────
  const challengesQuery = useChallenges();
  const challenges = challengesQuery.data ?? [];
  const createChallenge = useCreateChallenge();
  const updateChallenge = useUpdateChallenge();
  const deleteChallenge = useDeleteChallenge();

  // ── 클라이언트 상태(알고리즘 문제) ──────────────────────────────────────────
  const problems = useProblemStore((state) => state.problems);
  const upsertProblem = useProblemStore((state) => state.upsertProblem);
  const deleteProblem = useProblemStore((state) => state.deleteProblem);

  // ── Editing State ────────────────────────────────────────────────────────
  // editingId: string | null. null이면 새 문제 출제 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'web' | 'algo' | null>(null);

  // 웹 편집 대상은 전체 필드가 필요하므로 서버에서 단건 조회한다(목록은 요약 필드만).
  const isEditingWeb = editingType === 'web' && editingId !== null;
  const editingChallengeQuery = useChallengeForEdit(editingId ?? '', isEditingWeb);

  // 현재 편집 대상 찾기 (웹: 서버 단건, 알고: 로컬 스토어)
  const editingProblem: ChallengeProblem | Problem | null =
    editingId && editingType
      ? editingType === 'web'
        ? (editingChallengeQuery.data ?? null)
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

  const isSavingWeb = createChallenge.isPending || updateChallenge.isPending;
  const webSaveError = createChallenge.error ?? updateChallenge.error;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = async (
    type: 'web' | 'algo',
    problem: ChallengeProblem | Problem,
  ) => {
    if (type === 'web') {
      const challenge = problem as ChallengeProblem;
      if (editingType === 'web' && editingId !== null) {
        const updated = await updateChallenge.mutateAsync({
          id: editingId,
          patch: toChallengeInput(challenge),
        });
        setEditingId(updated.id);
      } else {
        const created = await createChallenge.mutateAsync(
          toChallengeInput(challenge),
        );
        setEditingId(created.id);
      }
      setEditingType('web');
    } else {
      upsertProblem(problem as Problem);
      setEditingId(problem.id);
      setEditingType('algo');
    }
  };

  const handleDelete = async () => {
    if (!editingId || !editingType) return;
    if (editingType === 'web') {
      await deleteChallenge.mutateAsync(editingId);
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

  // 웹 편집 대상의 단건 로딩/에러 상태(폼 표시 게이트)
  const isWebEditLoading = isEditingWeb && editingChallengeQuery.isLoading;
  const isWebEditError = isEditingWeb && editingChallengeQuery.isError;

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
            {challengesQuery.isLoading && <Empty>불러오는 중…</Empty>}
            {challengesQuery.isError && (
              <ErrorText>
                목록을 불러오지 못했습니다: {challengesQuery.error.message}
              </ErrorText>
            )}
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
            {!challengesQuery.isLoading &&
              !challengesQuery.isError &&
              allItems.length === 0 && <Empty>출제된 문제가 없습니다.</Empty>}
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
          {isWebEditLoading ? (
            <Empty>과제를 불러오는 중…</Empty>
          ) : isWebEditError ? (
            <ErrorText>
              과제를 불러오지 못했습니다:{' '}
              {editingChallengeQuery.error?.message ?? '알 수 없는 오류'}
            </ErrorText>
          ) : (
            <>
              <UnifiedProblemForm
                key={editingId ?? 'new'}
                initialType={editingType}
                initialProblem={editingProblem}
                onSubmit={handleSubmit}
                onDelete={editingProblem ? handleDelete : undefined}
                isSaving={isSavingWeb}
              />
              {webSaveError && (
                <ErrorText>저장에 실패했습니다: {webSaveError.message}</ErrorText>
              )}
            </>
          )}
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

const ErrorText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
`;
