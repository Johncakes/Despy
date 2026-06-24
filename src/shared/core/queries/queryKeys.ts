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
  // 도메인별 query key를 여기에 추가한다. (예: exams, problems, submissions)
} as const;
