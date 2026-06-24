/**
 * solveSessionStore.ts — 학생 풀이 세션 상태 (문제별)
 *
 * 학생이 푸는 동안의 클라이언트 상태를 문제별로 보관한다: 현재 작성 코드,
 * 선택 언어, 그리고 AI 사용량(질문 횟수·누적 토큰). 새로고침해도 진행이
 * 유지되도록 persist한다. AI 한도 강제는 이 사용량 카운터를 기준으로 한다.
 *
 * ⚠️ MVP 한계: 무인증·무서버세션이므로 한도 강제는 클라이언트 수준(UX)이며
 *    변조 불가능한 보안 수준은 아니다. (CLAUDE.md 「아키텍처 방향」 참조)
 *
 * persist key: 'despy-solve-session' (version 1)
 *
 * 사용처: features/solve (에디터/채팅/한도 표시)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────────────────

/** 문제 1개에 대한 풀이 세션 상태 */
export interface SolveSession {
  languageId: string;
  code: string;
  /** 지금까지 보낸 AI 질문 횟수 */
  questionsUsed: number;
  /** 지금까지 누적된 AI 토큰(입력+출력) */
  tokensUsed: number;
}

interface SolveSessionStoreState {
  sessions: Record<string, SolveSession>;
  /** 세션이 없으면 기본값으로 생성한다(이미 있으면 무시). */
  ensureSession: (problemId: string, defaults: SolveSession) => void;
  setCode: (problemId: string, code: string) => void;
  setLanguage: (problemId: string, languageId: string, code: string) => void;
  /** AI 응답 1턴을 기록: 질문 횟수 +1, 토큰 누적. */
  recordAiTurn: (problemId: string, totalTokens: number) => void;
  /** 해당 문제의 세션을 초기 기본값으로 되돌린다. */
  resetSession: (problemId: string, defaults: SolveSession) => void;
}

// ── 초기 상태 ───────────────────────────────────────────────────────────────

const initialSessions: Record<string, SolveSession> = {};

// ── Store 정의 ───────────────────────────────────────────────────────────────

export const useSolveSessionStore = create<SolveSessionStoreState>()(
  persist(
    (set) => ({
      sessions: initialSessions,

      ensureSession: (problemId, defaults) =>
        set((state) => {
          if (state.sessions[problemId]) return state;
          return { sessions: { ...state.sessions, [problemId]: defaults } };
        }),

      setCode: (problemId, code) =>
        set((state) => {
          const current = state.sessions[problemId];
          if (!current) return state;
          return {
            sessions: { ...state.sessions, [problemId]: { ...current, code } },
          };
        }),

      setLanguage: (problemId, languageId, code) =>
        set((state) => {
          const current = state.sessions[problemId];
          if (!current) return state;
          return {
            sessions: {
              ...state.sessions,
              [problemId]: { ...current, languageId, code },
            },
          };
        }),

      recordAiTurn: (problemId, totalTokens) =>
        set((state) => {
          const current = state.sessions[problemId];
          if (!current) return state;
          return {
            sessions: {
              ...state.sessions,
              [problemId]: {
                ...current,
                questionsUsed: current.questionsUsed + 1,
                tokensUsed: current.tokensUsed + totalTokens,
              },
            },
          };
        }),

      resetSession: (problemId, defaults) =>
        set((state) => ({
          sessions: { ...state.sessions, [problemId]: defaults },
        })),
    }),
    {
      name: 'despy-solve-session',
      version: 1,
    },
  ),
);
