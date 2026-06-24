/**
 * submissionQueries.ts — 제출 TanStack Query 훅
 *
 * 제출(서버 데이터)은 Query 캐시가 단일 출처다(Zustand submissionStore 대체 — M4).
 * 과제별 목록(교수 대시보드)·내 제출(마이페이지)·단일 조회는 query, 제출(서버 채점)은
 * mutation이며 성공 시 관련 목록 캐시를 무효화한다.
 *
 * 사용처: features/author(대시보드), features/solve(제출), features/mypage(내 제출)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listChallengeSubmissions,
  listMySubmissions,
  getSubmission,
  submitChallenge,
} from '@/shared/core/api/submissionApi';
import { queryKeys } from '@/shared/core/queries/queryKeys';
import type { Submission } from '@/shared/core/types';

// ── 조회 ───────────────────────────────────────────────────────────────────

/** 특정 과제의 제출 목록(교수 대시보드). 부모 출제자만 성공한다. */
export function useChallengeSubmissions(challengeId: string, enabled = true) {
  return useQuery<Submission[]>({
    queryKey: queryKeys.submissions.byChallenge(challengeId),
    queryFn: () => listChallengeSubmissions(challengeId),
    enabled: enabled && !!challengeId,
  });
}

/** 내 제출 목록(마이페이지). */
export function useMySubmissions() {
  return useQuery<Submission[]>({
    queryKey: queryKeys.submissions.mine,
    queryFn: listMySubmissions,
  });
}

/** 단일 제출(본인/출제자/admin). */
export function useSubmission(id: string, enabled = true) {
  return useQuery<Submission>({
    queryKey: queryKeys.submissions.detail(id),
    queryFn: () => getSubmission(id),
    enabled: enabled && !!id,
  });
}

// ── mutation ─────────────────────────────────────────────────────────────────

/**
 * 과제 제출(서버 채점+영속) mutation. mutateAsync({challengeId, request}) → Submission.
 * 성공 시 해당 과제 제출 목록과 내 제출 목록을 무효화한다.
 */
export function useSubmitChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitChallenge,
    onSuccess: (submission) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.byChallenge(submission.challengeId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions.mine });
    },
  });
}
