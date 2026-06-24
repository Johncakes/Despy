/**
 * algorithmGradeQueries.ts — 알고리즘 채점 mutation 훅 (TanStack Query)
 *
 * 채점은 서버(라우트 핸들러)에 부수효과를 일으키는 일회성 요청이므로 query가 아닌
 * mutation으로 다룬다. 컴포넌트는 이 훅만 사용하고 fetch는 algorithmGradeApi에 격리한다.
 * (구 Judge0 useGradeSubmission을 대체 — P5.)
 *
 * 사용처: features/solve/SolveView (제출 버튼)
 */
import { useMutation } from '@tanstack/react-query';
import { gradeAlgorithmSubmission } from '@/shared/core/api/algorithmGradeApi';
import type { GradingRequest, GradingResult } from '@/shared/core/types';

/** 제출 코드 AI 채점 mutation. mutate(request) → GradingResult */
export function useGradeAlgorithm() {
  return useMutation<GradingResult, Error, GradingRequest>({
    mutationFn: gradeAlgorithmSubmission,
  });
}
