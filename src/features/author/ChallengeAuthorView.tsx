/**
 * ChallengeAuthorView.tsx — 교수 과제 출제 화면 (과제 목록 + 편집 폼)
 *
 * 좌측에 출제된 과제 목록을, 우측에 선택한 과제의 편집 폼을 보여준다. 과제는
 * 서버(/api/challenges)에 영속되며 TanStack Query 캐시가 단일 출처다(challengeStore
 * 대체 — M4). 학생 워크스페이스 화면(/workspace/[id])이 같은 출처를 읽는다. 각
 * 과제에서 바로 풀이 화면으로 이동할 수 있다. (WebContainer 피벗 — 구 알고리즘
 * AuthorView 대응물)
 *
 * 사용처: app/author/challenge/page.tsx
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type {
  ChallengeInput,
  ChallengeProblem,
} from '@/shared/core/types';
import {
  useChallenges,
  useChallengeForEdit,
  useCreateChallenge,
  useUpdateChallenge,
  useDeleteChallenge,
} from '@/shared/core/queries/challengeQueries';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { ChallengeForm } from '@/features/author/components/ChallengeForm';

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

export function ChallengeAuthorView() {
  const challengesQuery = useChallenges();
  const challenges = challengesQuery.data ?? [];

  // null = 새 과제 출제 모드
  const [editingId, setEditingId] = useState<string | null>(null);

  // 편집 대상은 전체 필드가 필요하므로 서버에서 단건 조회한다(목록은 요약 필드만).
  const editingQuery = useChallengeForEdit(editingId ?? '', editingId !== null);
  const editingChallenge = editingId !== null ? (editingQuery.data ?? null) : null;

  const createChallenge = useCreateChallenge();
  const updateChallenge = useUpdateChallenge();
  const deleteChallenge = useDeleteChallenge();

  const isSaving = createChallenge.isPending || updateChallenge.isPending;
  const saveError = createChallenge.error ?? updateChallenge.error;

  const handleSubmit = async (challenge: ChallengeProblem) => {
    if (editingId !== null) {
      const updated = await updateChallenge.mutateAsync({
        id: editingId,
        patch: toChallengeInput(challenge),
      });
      setEditingId(updated.id);
    } else {
      const created = await createChallenge.mutateAsync(toChallengeInput(challenge));
      setEditingId(created.id);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    await deleteChallenge.mutateAsync(editingId);
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
            {challengesQuery.isLoading && <Empty>불러오는 중…</Empty>}
            {challengesQuery.isError && (
              <ErrorText>
                목록을 불러오지 못했습니다: {challengesQuery.error.message}
              </ErrorText>
            )}
            {!challengesQuery.isLoading &&
              !challengesQuery.isError &&
              challenges.map((challenge) => (
                <ListItem key={challenge.id} $active={challenge.id === editingId}>
                  <ItemButton
                    type="button"
                    $active={challenge.id === editingId}
                    onClick={() => setEditingId(challenge.id)}
                  >
                    {challenge.title || '(제목 없음)'}
                  </ItemButton>
                  <SolveLink href={`/workspace/${challenge.id}`}>풀기 →</SolveLink>
                </ListItem>
              ))}
            {!challengesQuery.isLoading &&
              !challengesQuery.isError &&
              challenges.length === 0 && <Empty>출제된 과제가 없습니다.</Empty>}
          </List>
        </Panel>
      </Sidebar>

      <Content>
        <Panel
          title={editingId !== null ? '과제 편집' : '새 과제 출제'}
          actions={
            editingId !== null ? (
              <DashboardLink href={`/author/challenge/${editingId}/submissions`}>
                채점 현황 →
              </DashboardLink>
            ) : undefined
          }
        >
          {editingId !== null && editingQuery.isLoading ? (
            <Empty>과제를 불러오는 중…</Empty>
          ) : editingId !== null && editingQuery.isError ? (
            <ErrorText>
              과제를 불러오지 못했습니다: {editingQuery.error.message}
            </ErrorText>
          ) : (
            <>
              <ChallengeForm
                key={editingId ?? 'new'}
                initialChallenge={editingChallenge}
                onSubmit={handleSubmit}
                onDelete={editingChallenge ? handleDelete : undefined}
                isSaving={isSaving}
              />
              {saveError && (
                <ErrorText>저장에 실패했습니다: {saveError.message}</ErrorText>
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
  text-align: left;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme, $active }) =>
    $active ? theme.font.weightBold : theme.font.weightRegular};
  cursor: pointer;
  padding: 0;
  font-family: inherit;
`;

const SolveLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
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
