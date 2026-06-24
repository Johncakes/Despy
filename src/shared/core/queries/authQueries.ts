/**
 * authQueries.ts — 인증·사용자 TanStack Query 훅
 *
 * 현재 사용자(서버 데이터)는 useCurrentUser(useQuery)가 단일 출처다. 별도 Zustand
 * auth store를 두지 않는다(서버 상태는 Query 캐시가 관리 — CLAUDE.md 상태관리 규칙).
 * 로그인/가입/로그아웃/역할변경은 mutation이며, 성공 시 관련 캐시를 무효화한다.
 *
 * 사용처: features/auth, features/admin, app/page(홈 헤더)
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchMe,
  login,
  logout,
  signup,
  listUsers,
  updateUserRole,
} from '@/shared/core/api/authApi';
import { queryKeys } from '@/shared/core/queries/queryKeys';
import type { AuthUser } from '@/shared/core/types';

// ── 현재 사용자 ───────────────────────────────────────────────────────────────

/** 현재 로그인 사용자(미로그인 시 null). 인증 상태의 단일 출처. */
export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: queryKeys.auth.me,
    queryFn: fetchMe,
    staleTime: 60_000,
  });
}

// ── 인증 mutation ─────────────────────────────────────────────────────────────

/** 로그인. 성공 시 me 캐시를 갱신한다. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
    },
  });
}

/** 회원가입. 성공 시 me 캐시를 갱신한다. */
export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signup,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
    },
  });
}

/** 로그아웃. 성공 시 me 캐시를 비우고 사용자 관련 캐시를 무효화한다. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users });
    },
  });
}

// ── 관리자 ─────────────────────────────────────────────────────────────────

/** 전체 사용자 목록(관리자 화면). */
export function useUsers() {
  return useQuery<AuthUser[]>({
    queryKey: queryKeys.admin.users,
    queryFn: listUsers,
  });
}

/** 역할 변경. 성공 시 사용자 목록을 무효화해 새로 받는다. */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users });
    },
  });
}
