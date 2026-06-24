/**
 * solveHistoryStore.ts — 알고리즘 문제 채점 이력 보관 스토어
 *
 * 학생이 채점을 실행할 때마다 최신 GradingResult를 문제별로 보관한다.
 * 마이페이지에서 "내가 푼 문제" 이력을 표시하는 데이터 소스가 된다.
 * 세션 상태(코드/AI 사용량)는 solveSessionStore가 담당하며, 이 스토어는
 * 채점 결과(통과율·피드백·제출 시각)만 저장한다.
 *
 * persist key: 'despy-solve-history' (version 1)
 *
 * 사용처: features/solve(채점 결과 저장), features/mypage(이력 조회)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GradingResult } from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

interface SolveHistoryStoreState {
  /** 문제 id → 마지막 채점 결과 */
  results: Record<string, GradingResult>;
  /** 채점 결과를 저장(덮어쓰기)한다. */
  saveResult: (problemId: string, result: GradingResult) => void;
  /** 특정 문제의 채점 이력을 삭제한다. */
  clearResult: (problemId: string) => void;
}

// ── 초기 상태 ───────────────────────────────────────────────────────────────

const initialResults: Record<string, GradingResult> = {};

// ── Store 정의 ───────────────────────────────────────────────────────────────

export const useSolveHistoryStore = create<SolveHistoryStoreState>()(
  persist(
    (set) => ({
      results: initialResults,

      saveResult: (problemId, result) =>
        set((state) => ({
          results: { ...state.results, [problemId]: result },
        })),

      clearResult: (problemId) =>
        set((state) => {
          const next = { ...state.results };
          delete next[problemId];
          return { results: next };
        }),
    }),
    {
      name: 'despy-solve-history',
      version: 1,
    },
  ),
);
