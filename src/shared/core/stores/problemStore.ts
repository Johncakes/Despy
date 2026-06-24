/**
 * problemStore.ts — 문제/AI정책 보관 스토어 (교수 출제 결과)
 *
 * 교수가 출제한 문제와 AI 정책을 클라이언트 상태로 보관한다. MVP는 별도
 * 백엔드/DB 없이 localStorage(persist)에 저장하므로 이 스토어가 문제 데이터의
 * 단일 출처다. 저장된 문제가 없으면 샘플 문제로 시드한다.
 *
 * persist key: 'despy-problems' (version 1)
 *
 * 사용처: features/author(CRUD), features/solve(읽기), app 홈(목록)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Problem } from '@/shared/core/types';
import { SAMPLE_PROBLEMS } from '@/shared/core/constants/sampleProblems';

// ── Types ─────────────────────────────────────────────────────────────────

interface ProblemStoreState {
  problems: Problem[];
  /** 문제를 추가하거나(없으면) 갱신한다(있으면). updatedAt을 갱신. */
  upsertProblem: (problem: Problem) => void;
  /** id로 문제를 삭제한다. */
  deleteProblem: (problemId: string) => void;
}

// ── 초기 상태 ───────────────────────────────────────────────────────────────

const initialProblems: Problem[] = SAMPLE_PROBLEMS;

// ── Store 정의 ───────────────────────────────────────────────────────────────

export const useProblemStore = create<ProblemStoreState>()(
  persist(
    (set) => ({
      problems: initialProblems,

      upsertProblem: (problem) =>
        set((state) => {
          const now = Date.now();
          const exists = state.problems.some((item) => item.id === problem.id);
          if (exists) {
            return {
              problems: state.problems.map((item) =>
                item.id === problem.id ? { ...problem, updatedAt: now } : item,
              ),
            };
          }
          return {
            problems: [
              ...state.problems,
              { ...problem, createdAt: now, updatedAt: now },
            ],
          };
        }),

      deleteProblem: (problemId) =>
        set((state) => ({
          problems: state.problems.filter((item) => item.id !== problemId),
        })),
    }),
    {
      name: 'despy-problems',
      version: 1,
    },
  ),
);

// ── Selector 헬퍼 ─────────────────────────────────────────────────────────────

/** 스토어 밖(이벤트 핸들러 등)에서 문제를 동기 조회한다. */
export function getProblemById(problemId: string): Problem | undefined {
  return useProblemStore.getState().problems.find((item) => item.id === problemId);
}
