/**
 * gradeQueries.ts — 과제 채점 mutation 훅 (TanStack Query)
 *
 * 과제 채점은 서버(/api/grade)에 부수효과를 일으키는 일회성 요청이므로 query가
 * 아닌 mutation으로 다룬다. 컴포넌트는 이 훅만 사용하고 fetch는 gradeApi에
 * 격리한다. (웹 과제 채점 — 알고리즘 채점은 useGradeAlgorithm이 담당.)
 *
 * 사용처: features/solve 과제 제출 플로우 (ChallengeSolveView)
 */
import { useMutation } from '@tanstack/react-query';
import { gradeChallenge } from '@/shared/core/api/gradeApi';
import type {
  ChallengeGradingRequest,
  ChallengeGradingResult,
} from '@/shared/core/types';

/** 과제 제출물 채점 mutation. mutateAsync(request) → ChallengeGradingResult */
export function useGradeChallenge() {
  return useMutation<ChallengeGradingResult, Error, ChallengeGradingRequest>({
    mutationFn: gradeChallenge,
  });
}
