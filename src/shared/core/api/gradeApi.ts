/**
 * gradeApi.ts — 과제 채점 데이터 접근 (/api/grade 호출)
 *
 * 학생 제출물·루브릭·자동테스트 결과를 /api/grade 라우트로 보내 공식 채점 결과
 * (AI 루브릭 정성 채점 + 가중합)를 받는다. 라우트가 채점기 호출·점수 확정을
 * 담당하므로 클라이언트는 도메인 형태(ChallengeGradingRequest/Result)만 다룬다.
 * 모든 채점 fetch는 이 파일에만 둔다.
 *
 * 사용처: shared/core/queries/gradeQueries
 */
import type {
  ChallengeGradingRequest,
  ChallengeGradingResult,
} from '@/shared/core/types';

/** 과제 제출물을 채점 요청한다. 실패 시 에러를 throw한다. */
export async function gradeChallenge(
  request: ChallengeGradingRequest,
): Promise<ChallengeGradingResult> {
  const response = await fetch('/api/grade', {
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

  return (await response.json()) as ChallengeGradingResult;
}
