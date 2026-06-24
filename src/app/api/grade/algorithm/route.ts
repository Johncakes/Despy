/**
 * route.ts (/api/grade/algorithm) — 알고리즘 공식 채점 (AI 정성 판정, P5)
 *
 * Judge0 실행 채점을 대체한다. 학생 제출 코드·지문·테스트케이스를 받아 grader(추상화)로
 * 케이스별 정답성을 판정한다. ⚠️ AI는 코드를 실행하지 않고 로직을 추론해 판정하므로
 * 정답성·엣지케이스는 근사이며 시간/메모리 초과는 측정할 수 없다(무결성 한계는 UI에 명시).
 * 채점 가드레일(인젝션 방어)은 grader 구현(geminiGrader)에서 강제한다.
 *
 * 사용처: shared/core/api/algorithmGradeApi (SolveView 제출 플로우)
 */
import { grader } from '@/shared/lib/grader';
import {
  validateAlgorithmRequest,
  asAlgorithmRequest,
} from '@/shared/lib/grader/requestValidation';
import { findLanguageById } from '@/shared/core/constants/languages';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  if (!grader.isAvailable()) {
    return new Response(
      'AI API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가하세요.',
      { status: 500 },
    );
  }

  // 잘못된/비어 있는 JSON 본문은 클라이언트 잘못으로 보고 400으로 명확히 돌려준다.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response('요청 본문(JSON) 파싱에 실패했습니다.', { status: 400 });
  }

  const validationError = validateAlgorithmRequest(raw);
  if (validationError) {
    return new Response(validationError, { status: 400 });
  }
  const body = asAlgorithmRequest(raw);

  // 채점기(LLM) 호출은 네트워크·쿼터·구조화 출력 실패로 throw될 수 있다. 읽을 수 있는
  // 메시지와 함께 502(상위 서비스 실패)로 돌려준다.
  try {
    const result = await grader.gradeAlgorithm({
      problemId: body.problemId,
      statement: body.statement ?? '',
      languageLabel: findLanguageById(body.languageId)?.label ?? body.languageId,
      languageId: body.languageId,
      sourceCode: body.sourceCode,
      testCases: body.testCases,
      model: body.model ?? '',
      systemPrompt: body.systemPrompt,
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[api/grade/algorithm] 채점 실패', error);
    return new Response(`채점 중 오류가 발생했습니다: ${message}`, {
      status: 502,
    });
  }
}
