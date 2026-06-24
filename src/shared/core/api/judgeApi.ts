/**
 * judgeApi.ts — 채점 데이터 접근 (Judge0 프록시 호출)
 *
 * 학생 제출 코드를 우리 /api/judge 라우트로 보내 채점 결과를 받는다. 라우트
 * 핸들러가 Judge0 호출(또는 mock)을 담당하므로 클라이언트는 도메인 형태의
 * GradingRequest/GradingResult만 다룬다. 모든 채점 fetch는 이 파일에만 둔다.
 *
 * 사용처: shared/core/queries/judgeQueries
 */
import type { GradingRequest, GradingResult } from '@/shared/core/types';

/** 제출 코드를 채점 요청한다. 실패 시 에러를 throw한다. */
export async function gradeSubmission(
  request: GradingRequest,
): Promise<GradingResult> {
  const response = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(
      `채점 요청 실패 (${response.status}): ${message || response.statusText}`,
    );
  }

  return (await response.json()) as GradingResult;
}
