/**
 * challengeQueries.ts — 과제 TanStack Query 훅
 *
 * 과제(서버 데이터)는 Query 캐시가 단일 출처다(Zustand challengeStore 대체 — M4).
 * 목록·단일 조회는 query, 생성/수정/삭제는 mutation이며 성공 시 관련 캐시를 무효화한다.
 * 컴포넌트는 fetch를 직접 하지 않고 이 훅만 쓴다.
 *
 * 사용처: features/author(목록·CRUD), features/solve(풀이용 단일), 홈(목록)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listChallenges,
  getChallengeForEdit,
  getChallengeForSolve,
  createChallenge,
  updateChallenge,
  deleteChallenge,
} from '@/shared/core/api/challengeApi';
import { queryKeys } from '@/shared/core/queries/queryKeys';
import type {
  ChallengeProblem,
  ChallengeSummary,
  StudentChallenge,
} from '@/shared/core/types';

// ── 조회 ───────────────────────────────────────────────────────────────────

/** 과제 목록(역할별 필터). 홈·출제 목록의 단일 출처. */
export function useChallenges() {
  return useQuery<ChallengeSummary[]>({
    queryKey: queryKeys.challenges.all,
    queryFn: listChallenges,
  });
}

/** 단일 과제(편집용 — 전체 필드). 출제자·admin만 성공한다. */
export function useChallengeForEdit(id: string, enabled = true) {
  return useQuery<ChallengeProblem>({
    queryKey: queryKeys.challenges.detail(id),
    queryFn: () => getChallengeForEdit(id),
    enabled: enabled && !!id,
  });
}

/** 단일 과제(풀이용 — 학생 DTO, 채점 재료·민감정보 제거). */
export function useChallengeForSolve(id: string, enabled = true) {
  return useQuery<StudentChallenge>({
    queryKey: queryKeys.challenges.solve(id),
    queryFn: () => getChallengeForSolve(id),
    enabled: enabled && !!id,
  });
}

// ── mutation ─────────────────────────────────────────────────────────────────

/** 과제 생성. 성공 시 목록을 무효화한다. */
export function useCreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
  });
}

/** 과제 수정. 성공 시 목록·해당 상세를 무효화한다. */
export function useUpdateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateChallenge,
    onSuccess: (challenge) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.challenges.detail(challenge.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.challenges.solve(challenge.id),
      });
    },
  });
}

/** 과제 삭제. 성공 시 목록을 무효화한다. */
export function useDeleteChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all });
    },
  });
}
