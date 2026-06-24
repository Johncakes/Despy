/**
 * route.ts (/api/grade) — 공식 채점 (AI 루브릭 정성 채점, 신규 P3)
 *
 * 백엔드 최소화 원칙 해제(2026-06-24 §13 결정6) 이후 채점 권한의 경계. 학생 제출물·
 * 루브릭·자동테스트 결과를 받아 (1) grader(추상화)로 AI 루브릭 정성 채점을 수행하고,
 * (2) 자동 테스트 통과율과 루브릭 점수를 weights로 가중합해 0~100 최종 점수를 확정한다.
 *
 * ⚠️ 무결성: 요청의 autoTest는 풀이 중 클라이언트가 본 *즉시 피드백*일 뿐이다. 공식
 *    점수의 서버측 테스트 재실행(샌드박스)은 P3 이후 별도 단계로 붙는다(§7.2). 현재는
 *    클라이언트 autoTest를 참고 신호로 받되, 루브릭 채점은 서버에서 확정한다.
 *
 * 사용처: features/solve 제출 플로우(ChallengeSolveView → useGradeChallenge → gradeApi, P3 연결)
 */
import { grader } from '@/shared/lib/grader';
import { computeFinalScore } from '@/shared/lib/grader/score';
import {
  validateGradeRequest,
  asGradeRequest,
} from '@/shared/lib/grader/requestValidation';
import { requireUser, authErrorToResponse } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';
import type { ChallengeGradingResult } from '@/shared/core/types';

export const runtime = 'nodejs';

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // 인증 가드 — 로그인한 사용자만 채점을 요청할 수 있다.
  try {
    await requireUser();
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  if (!grader.isAvailable()) {
    return new Response(
      'AI API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가하세요.',
      { status: 500 },
    );
  }

  // 잘못된/비어 있는 JSON 본문은 req.json()이 throw한다. 그대로 두면 처리 안 된
  // 500이 되므로, 파싱 실패는 클라이언트 잘못으로 보고 400으로 명확히 돌려준다.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response('요청 본문(JSON) 파싱에 실패했습니다.', { status: 400 });
  }

  const validationError = validateGradeRequest(raw);
  if (validationError) {
    return new Response(validationError, { status: 400 });
  }
  const body = asGradeRequest(raw);

  // 채점기(LLM) 호출은 네트워크·쿼터·구조화 출력 실패로 throw될 수 있다. 그대로
  // 던지면 본문 없는 500이 되어 클라이언트가 사유를 알 수 없으므로, 여기서 잡아
  // 읽을 수 있는 메시지와 함께 502(상위 서비스 실패)로 돌려준다.
  try {
    const rubricResult = await grader.gradeRubric({
      statement: body.statement,
      rubric: body.rubric,
      submittedFiles: body.submittedFiles,
      diff: body.diff,
      autoTest: body.autoTest,
      model: body.model ?? '',
      systemPrompt: body.systemPrompt,
    });

    const finalScore = computeFinalScore(
      body.autoTest,
      rubricResult,
      body.rubric.weights,
    );

    const result: ChallengeGradingResult = {
      problemId: body.problemId,
      autoTest: body.autoTest,
      rubric: rubricResult,
      finalScore,
      submittedAt: Date.now(),
    };

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[api/grade] 채점 실패', error);
    return new Response(`채점 중 오류가 발생했습니다: ${message}`, {
      status: 502,
    });
  }
}
