/**
 * AdminUsersView.tsx — 사용자/역할 관리 화면 (관리자 전용)
 *
 * 전체 사용자를 표로 보여주고, 역할 드롭다운으로 학생/교수/관리자를 승격·강등한다.
 * 자기 자신의 역할은 변경할 수 없다(서버에서도 차단 — 락아웃 방지). 페이지 접근 자체는
 * 미들웨어가 admin으로 제한하지만, 화면도 useCurrentUser로 admin이 아니면 안내를 띄운다.
 *
 * 사용처: app/admin/users/page.tsx
 */
'use client';

import styled from 'styled-components';
import {
  useCurrentUser,
  useUsers,
  useUpdateUserRole,
} from '@/shared/core/queries/authQueries';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { Panel } from '@/shared/components/ui/Panel';
import { Select } from '@/shared/components/ui/Field';
import type { UserRole } from '@/shared/core/types';

// ── Constants ───────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'student', label: '학생' },
  { value: 'professor', label: '교수' },
  { value: 'admin', label: '관리자' },
];

// ── Component ─────────────────────────────────────────────────────────────

export function AdminUsersView() {
  const hasMounted = useHasMounted();
  const { data: currentUser } = useCurrentUser();
  const { data: users, isLoading, isError, error } = useUsers();
  const updateRole = useUpdateUserRole();

  const onRoleChange = (userId: string, role: UserRole) => {
    updateRole.mutate({ userId, role });
  };

  return (
    <Main>
      <Panel title="사용자 관리 (역할 승격)">
        {!hasMounted || isLoading ? (
          <Empty>불러오는 중…</Empty>
        ) : isError ? (
          <Empty>목록을 불러오지 못했습니다: {error.message}</Empty>
        ) : !users || users.length === 0 ? (
          <Empty>사용자가 없습니다.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>이름</Th>
                <Th>이메일</Th>
                <Th>역할</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id}>
                    <Td>{user.name}</Td>
                    <Td>{user.email}</Td>
                    <Td>
                      <Select
                        value={user.role}
                        disabled={isSelf || updateRole.isPending}
                        onChange={(e) =>
                          onRoleChange(user.id, e.target.value as UserRole)
                        }
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      {isSelf && <SelfNote>(본인)</SelfNote>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {updateRole.isError && (
          <Empty>역할 변경 실패: {updateRole.error.message}</Empty>
        )}
      </Panel>
    </Main>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Main = styled.main`
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeMd};
  color: ${({ theme }) => theme.colors.text};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  vertical-align: middle;
`;

const SelfNote = styled.span`
  margin-left: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Empty = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
