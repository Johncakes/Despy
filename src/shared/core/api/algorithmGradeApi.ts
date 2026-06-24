/**
 * algorithmGradeApi.ts — 알고리즘 채점 데이터 접근 (AI 정성 채점)
 *
 * 학생 제출 코드를 우리 /api/grade/algorithm 라우트로 보내 채점 결과를 받는다. 라우트
 * 핸들러가 AI 채점(grader)을 담당하므로 클라이언트는 도메인 형태의
 * GradingRequest/GradingResult만 다룬다. 알고리즘 채점 fetch는 이 파일에만 둔다.
 * (구 Judge0 judgeApi를 대체 — P5.)
 *
 * 사용처: shared/core/queries/algorithmGradeQueries
 */
import type { GradingRequest, GradingResult } from '@/shared/core/types';

/** 제출 코드를 AI 채점 요청한다. 실패 시 에러를 throw한다. */
export async function gradeAlgorithmSubmission(
  request: GradingRequest,
): Promise<GradingResult> {
  const response = await fetch('/api/grade/algorithm', {
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
