/**
 * challengeStore.ts — 과제(ChallengeProblem) 보관 스토어 (교수 출제 결과)
 *
 * 교수가 출제한 실무형 웹 과제(시작 파일트리·잠금경로·테스트·루브릭·AI정책)를
 * 클라이언트 상태로 보관한다. 과제 정의는 크기가 한정적이라 localStorage(persist)에
 * 둔다. (학생별 워크스페이스 파일 버퍼/델타는 용량이 커 별도 저장소가 필요하며,
 * 그 영속은 P4에서 IndexedDB로 도입한다 — docs/spec-webcontainer.md §9.1.)
 * 저장된 과제가 없으면 샘플 과제로 시드한다.
 *
 * persist key: 'despy-challenges' (version 1)
 *
 * 사용처: features/author(CRUD, P4), features/solve(읽기), app 홈(목록)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChallengeProblem } from '@/shared/core/types';
import { SAMPLE_CHALLENGES } from '@/shared/core/constants/sampleChallenges';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChallengeStoreState {
  challenges: ChallengeProblem[];
  /** 과제를 추가하거나(없으면) 갱신한다(있으면). updatedAt을 갱신. */
  upsertChallenge: (challenge: ChallengeProblem) => void;
  /** id로 과제를 삭제한다. */
  deleteChallenge: (challengeId: string) => void;
}

// ── 초기 상태 ───────────────────────────────────────────────────────────────

const initialChallenges: ChallengeProblem[] = SAMPLE_CHALLENGES;

// ── Store 정의 ───────────────────────────────────────────────────────────────

export const useChallengeStore = create<ChallengeStoreState>()(
  persist(
    (set) => ({
      challenges: initialChallenges,

      upsertChallenge: (challenge) =>
        set((state) => {
          const now = Date.now();
          const exists = state.challenges.some((item) => item.id === challenge.id);
          if (exists) {
            return {
              challenges: state.challenges.map((item) =>
                item.id === challenge.id ? { ...challenge, updatedAt: now } : item,
              ),
            };
          }
          return {
            challenges: [
              ...state.challenges,
              { ...challenge, createdAt: now, updatedAt: now },
            ],
          };
        }),

      deleteChallenge: (challengeId) =>
        set((state) => ({
          challenges: state.challenges.filter((item) => item.id !== challengeId),
        })),
    }),
    {
      name: 'despy-challenges',
      version: 1,
    },
  ),
);

// ── Selector 헬퍼 ─────────────────────────────────────────────────────────────

/** 스토어 밖(이벤트 핸들러 등)에서 과제를 동기 조회한다. */
export function getChallengeById(challengeId: string): ChallengeProblem | undefined {
  return useChallengeStore.getState().challenges.find((item) => item.id === challengeId);
}
