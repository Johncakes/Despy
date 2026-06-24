/**
 * workspaceStore.ts — 학생 워크스페이스 세션 영속 (과제별 파일 델타 + AI 사용량)
 *
 * 학생이 풀이 중 편집한 파일 버퍼와 AI 사용량(질문 횟수·누적 토큰)을 과제(challenge)
 * 별로 보관해 새로고침 후에도 진행이 유지되게 한다(docs/spec-webcontainer.md §9.1, P4).
 *
 * 파일은 **템플릿 대비 변경분(delta)만** 저장한다 — 전체 파일트리는 용량이 커
 * (localStorage quota 초과 위험) IndexedDB에 두고, 복원 시 template과 병합한다
 * (files = { ...template, ...fileDelta }). 따라서 이 스토어는 IndexedDB를 백엔드로
 * 쓰며(idbStorage), rehydrate가 비동기다 → hasHydrated로 복원 완료를 노출해
 * useWorkspace가 mount(boot)를 복원 이후로 게이트하게 한다.
 *
 * ⚠️ MVP 한계: 무인증·무서버세션이라 AI 한도 강제는 클라이언트(UX) 수준이다
 *    (CLAUDE.md 「아키텍처 방향」 참조).
 *
 * persist key: 'despy-workspace' (version 1) — 신규 키라 마이그레이션 불필요(클린 슬레이트, §9.1).
 *
 * 사용처: features/solve/useWorkspace (파일 델타 복원/저장 + AI 사용량 기록/표시)
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProjectFiles } from '@/shared/core/types';
import { idbStorage } from '@/shared/core/stores/idbStorage';

// ── Types ─────────────────────────────────────────────────────────────────

/** 과제 1개에 대한 워크스페이스 세션(영속 대상) */
export interface WorkspaceSession {
  /** 템플릿 대비 변경/추가된 파일만(경로→내용). 복원 시 template과 병합. */
  fileDelta: ProjectFiles;
  /** 마지막으로 열어둔 파일 경로 */
  activePath: string;
  /** 지금까지 보낸 AI 질문 횟수 */
  questionsUsed: number;
  /** 지금까지 누적된 AI 토큰(입력+출력) */
  tokensUsed: number;
  updatedAt: number;
}

interface WorkspaceStoreState {
  sessions: Record<string, WorkspaceSession>;
  /** IndexedDB rehydrate(비동기) 완료 여부 — 복원 전 boot/렌더 게이트용. */
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  /** 변경 파일 델타를 통째로 갱신한다(편집 debounce 후 호출). */
  saveFileDelta: (challengeId: string, fileDelta: ProjectFiles) => void;
  /** 마지막 활성 파일 경로를 저장한다(파일 전환 시). */
  saveActivePath: (challengeId: string, activePath: string) => void;
  /** AI 응답 1턴 기록: 질문 횟수 +1, 토큰 누적. */
  recordAiTurn: (challengeId: string, totalTokens: number) => void;
  /** 해당 과제 세션을 비운다(다시 시작). */
  resetSession: (challengeId: string) => void;
}

// ── 초기 상태 ───────────────────────────────────────────────────────────────

const initialSessions: Record<string, WorkspaceSession> = {};

/** 세션이 없을 때 머지의 기준이 되는 빈 세션. */
function emptySession(): WorkspaceSession {
  return {
    fileDelta: {},
    activePath: '',
    questionsUsed: 0,
    tokensUsed: 0,
    updatedAt: Date.now(),
  };
}

// ── Store 정의 ───────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      sessions: initialSessions,
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      saveFileDelta: (challengeId, fileDelta) =>
        set((state) => {
          const current = state.sessions[challengeId] ?? emptySession();
          return {
            sessions: {
              ...state.sessions,
              [challengeId]: { ...current, fileDelta, updatedAt: Date.now() },
            },
          };
        }),

      saveActivePath: (challengeId, activePath) =>
        set((state) => {
          const current = state.sessions[challengeId] ?? emptySession();
          if (current.activePath === activePath) return state;
          return {
            sessions: {
              ...state.sessions,
              [challengeId]: { ...current, activePath, updatedAt: Date.now() },
            },
          };
        }),

      recordAiTurn: (challengeId, totalTokens) =>
        set((state) => {
          const current = state.sessions[challengeId] ?? emptySession();
          return {
            sessions: {
              ...state.sessions,
              [challengeId]: {
                ...current,
                questionsUsed: current.questionsUsed + 1,
                tokensUsed: current.tokensUsed + totalTokens,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      resetSession: (challengeId) =>
        set((state) => {
          if (!state.sessions[challengeId]) return state;
          const next = { ...state.sessions };
          delete next[challengeId];
          return { sessions: next };
        }),
    }),
    {
      name: 'despy-workspace',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      // 메서드·hasHydrated는 영속 대상이 아니다 — sessions만 저장한다.
      partialize: (state) => ({ sessions: state.sessions }),
      // 비동기 rehydrate 완료(데이터 유무·에러 무관) 시점에 복원 게이트를 연다.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// ── Selector 헬퍼 ─────────────────────────────────────────────────────────────

/** 스토어 밖(useWorkspace의 boot 시퀀스 등)에서 세션을 동기 조회한다. */
export function getWorkspaceSession(
  challengeId: string,
): WorkspaceSession | undefined {
  return useWorkspaceStore.getState().sessions[challengeId];
}
