/**
 * queryKeys.ts — TanStack Query 키 팩토리 (중앙화)
 *
 * 모든 query key는 배열 팩토리로 이 한 곳에서 정의한다. 문자열을 흩뿌리지
 * 않아 무효화(invalidate)·캐시 키 충돌을 방지한다.
 *
 * 사용처: shared/core/queries/*Queries.ts, 컴포넌트의 invalidateQueries
 *
 * 예시(도메인 추가 시):
 *   problems: {
 *     all: ['problems'] as const,
 *     detail: (id: string) => ['problems', id] as const,
 *   },
 */

export const queryKeys = {
  auth: {
    /** 현재 로그인 사용자(/api/auth/me) */
    me: ['auth', 'me'] as const,
  },
  admin: {
    /** 전체 사용자 목록(/api/admin/users) */
    users: ['admin', 'users'] as const,
  },
  challenges: {
    /** 과제 목록(/api/challenges, 역할별 필터) */
    all: ['challenges'] as const,
    /** 단일 과제(편집용 — 전체 필드, /api/challenges/[id]) */
    detail: (id: string) => ['challenges', id] as const,
    /** 단일 과제(풀이용 — 학생 DTO). detail과 응답 shape가 달라 키를 분리한다. */
    solve: (id: string) => ['challenges', id, 'solve'] as const,
  },
  submissions: {
    /** 특정 과제의 제출 목록(/api/challenges/[id]/submissions — 교수 대시보드) */
    byChallenge: (challengeId: string) =>
      ['submissions', 'challenge', challengeId] as const,
    /** 내 제출 목록(/api/submissions/mine — 마이페이지) */
    mine: ['submissions', 'mine'] as const,
    /** 단일 제출(/api/submissions/[id]) */
    detail: (id: string) => ['submissions', id] as const,
  },
  // 도메인별 query key를 여기에 추가한다. (예: problems — 알고리즘, Phase 3)
} as const;
