/**
 * submissionStore.ts — 학생 제출(채점 결과) 보관 스토어 (교수 대시보드 데이터 소스)
 *
 * 학생이 풀이 화면에서 제출해 받은 공식 채점 결과(ChallengeGradingResult)를 과제별로
 * 모아 둔다. 교수 채점 대시보드(GradingDashboardView)가 이 스토어를 읽어 제출 목록·
 * 점수를 보여준다. 제출 결과는 파일트리가 없어(점수·루브릭·피드백뿐) 작고 동기 조회가
 * 편하므로 localStorage(persist)에 둔다(워크스페이스 파일 버퍼와 달리 IndexedDB 불필요).
 *
 * ⚠️ MVP 한계: 인증·교수/학생 분리·다중 사용자·서버 집계는 범위 밖이다. 따라서 이 기록은
 *    **이 브라우저에서 이뤄진 제출들**이며, 학생 식별은 제출 시 입력한 이름/별명에 의존한다
 *    (변조 불가능한 보안 수준 아님 — CLAUDE.md 「아키텍처 방향」 참조).
 *
 * persist key: 'despy-submissions' (version 2)
 *
 * ML 챌린지 제출의 성능 점수(객관)·합격 여부는 result.ml(MlGradingResult)에 담긴다 —
 * StoredSubmission에 별도 필드를 두지 않는다(선택 필드라 구버전 제출과 호환, 마이그레이션
 * 불필요). finalScore(0~100, 가중합)와 ml.value(원시 지표)는 척도가 다르므로 분리 유지한다.
 *
 * 사용처: features/solve(제출 기록), features/author(대시보드 조회)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChallengeGradingResult, ProjectFiles } from '@/shared/core/types';
import type { IntegrityLog } from '@/shared/lib/hooks/useProctoringMonitor';

// ── Types ─────────────────────────────────────────────────────────────────

/** AI 대화 1턴(제출 기록에 보관) — 학생 프롬프트 또는 AI 응답. */
export interface SubmissionPromptTurn {
  role: 'user' | 'assistant';
  /** 학생 프롬프트는 코드 첨부분을 제외한 질문만, AI 응답은 본문 텍스트. */
  text: string;
  /**
   * user 턴 한정 — 이 프롬프트를 **작성한 시점**의 코드 상태(템플릿 대비 변경 파일 델타).
   * 대시보드가 연속 스냅샷을 비교해 "프롬프트가 만든 변경점(diff)"을 보여준다.
   * assistant 턴·구버전 기록엔 없을 수 있어 선택.
   */
  filesAtSend?: ProjectFiles;
}

/** 저장되는 제출 1건 — 채점 결과 + 식별 정보(이름/별명) + 제출 코드·프롬프트 스냅샷. */
export interface StoredSubmission {
  /** 제출 고유 id(클라이언트 생성). */
  id: string;
  /** 제출 시 입력한 이름/별명(비우면 '익명'). */
  studentName: string;
  /** 공식 채점 결과(서버 /api/grade 응답). submittedAt·finalScore 포함. */
  result: ChallengeGradingResult;
  /** 제출 시 학생이 변경한 코드(경로→내용). 구버전 기록엔 없을 수 있어 선택. */
  submittedFiles?: ProjectFiles;
  /** 제출 시점까지의 AI 대화(프롬프트+응답). 구버전 기록엔 없을 수 있어 선택. */
  prompts?: SubmissionPromptTurn[];
  /** 제출 시점 AI 사용량(질문 횟수·누적 토큰) — "AI를 얼마나 부렸는지" 지표. 구버전엔 없을 수 있어 선택. */
  aiUsage?: { questionsUsed: number; tokensUsed: number };
  /** 시험 감독 로그 — 탭 이탈·외부 붙여넣기·전체화면 이탈 카운트. 구버전엔 없을 수 있어 선택. */
  integrityLog?: IntegrityLog;
}

interface SubmissionStoreState {
  /** 과제 id → 제출 목록(삽입 순서; 표시는 조회 측에서 정렬). */
  submissions: Record<string, StoredSubmission[]>;
  /** 제출 1건을 해당 과제 목록에 추가한다. */
  addSubmission: (challengeId: string, submission: StoredSubmission) => void;
  /** 해당 과제의 제출 기록을 모두 비운다(대시보드 정리용). */
  clearSubmissions: (challengeId: string) => void;
}

// ── 초기 상태 ───────────────────────────────────────────────────────────────

const initialSubmissions: Record<string, StoredSubmission[]> = {};

// ── Store 정의 ───────────────────────────────────────────────────────────────

export const useSubmissionStore = create<SubmissionStoreState>()(
  persist(
    (set) => ({
      submissions: initialSubmissions,

      addSubmission: (challengeId, submission) =>
        set((state) => ({
          submissions: {
            ...state.submissions,
            [challengeId]: [...(state.submissions[challengeId] ?? []), submission],
          },
        })),

      clearSubmissions: (challengeId) =>
        set((state) => {
          if (!state.submissions[challengeId]) return state;
          const next = { ...state.submissions };
          delete next[challengeId];
          return { submissions: next };
        }),
    }),
    {
      name: 'despy-submissions',
      version: 2,
      migrate: (state, version) => {
        // v1 → v2: integrityLog 필드 추가(optional이라 기존 제출은 그대로 사용 가능).
        if (version < 2) return state;
        return state;
      },
    },
  ),
);

// ── Selector 헬퍼 ─────────────────────────────────────────────────────────────

/** 스토어 밖에서 특정 과제의 제출 목록을 동기 조회한다. */
export function getSubmissions(challengeId: string): StoredSubmission[] {
  return useSubmissionStore.getState().submissions[challengeId] ?? [];
}
