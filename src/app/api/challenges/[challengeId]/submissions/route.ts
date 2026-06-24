/**
 * route.ts (/api/challenges/[challengeId]/submissions) — 과제별 제출 목록·생성 (M4 서버 영속)
 *
 * GET: 교수 채점 대시보드(GradingDashboardView)의 데이터 피드 — 해당 과제를 **본인이
 *   출제한** 교수(또는 admin)만 그 과제의 모든 학생 제출을 본다. 비소유 교수는 403.
 *   이로써 "교수가 자기 브라우저 제출만 보던" per-browser 한계가 해소된다.
 *
 * POST: 학생이 과제를 제출한다. 서버가 **저장된 과제의 rubric**으로 채점해(클라가 보낸
 *   채점 기준 불신뢰) 결과를 영속한다. studentName은 인증된 사용자 이름 스냅샷.
 *
 * 사용처: features/author GradingDashboardView(GET), features/solve ChallengeSolveView(POST)
 */
import { findChallengeDoc } from '@/shared/lib/db/challenges';
import {
  listSubmissionsByChallenge,
  createSubmission,
} from '@/shared/lib/db/submissions';
import { grader } from '@/shared/lib/grader';
import { gradeChallengeSubmission } from '@/shared/lib/grader/gradeChallenge';
import {
  requireUser,
  requireRole,
  authErrorToResponse,
} from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';
import type { ChallengeSubmitRequest } from '@/shared/core/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ challengeId: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  try {
    const user = await requireRole(['professor', 'admin']);
    const { challengeId } = await ctx.params;

    const doc = await findChallengeDoc(challengeId);
    if (!doc) {
      return Response.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 });
    }
    // 소유권: 본인이 출제한 과제의 제출만 열람(admin 제외). 비소유 교수는 403.
    if (doc.authorId !== user.id && user.role !== 'admin') {
      return Response.json(
        { error: '이 과제의 제출을 조회할 권한이 없습니다.' },
        { status: 403 },
      );
    }

    const submissions = await listSubmissionsByChallenge(challengeId);
    return Response.json({ submissions });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('제출 목록 조회 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  let challengeId: string;
  let user;
  try {
    user = await requireUser();
    ({ challengeId } = await ctx.params);
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('제출 인증 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  if (!grader.isAvailable()) {
    return Response.json(
      { error: 'AI 채점기가 설정되지 않았습니다(GEMINI_API_KEY).' },
      { status: 500 },
    );
  }

  const doc = await findChallengeDoc(challengeId);
  if (!doc) {
    return Response.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 });
  }

  let body: ChallengeSubmitRequest;
  try {
    body = (await req.json()) as ChallengeSubmitRequest;
  } catch {
    return Response.json(
      { error: '요청 본문(JSON) 파싱에 실패했습니다.' },
      { status: 400 },
    );
  }
  if (!body?.submittedFiles || typeof body.submittedFiles !== 'object') {
    return Response.json(
      { error: '제출 파일(submittedFiles)이 필요합니다.' },
      { status: 400 },
    );
  }
  if (!body.autoTest) {
    return Response.json(
      { error: '자동 테스트 결과(autoTest)가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    // 채점은 저장된 과제의 rubric/aiPolicy로 서버가 확정한다(클라가 보낸 기준 불신뢰).
    const result = await gradeChallengeSubmission({
      problemId: challengeId,
      statement: doc.statement,
      rubric: doc.rubric,
      submittedFiles: body.submittedFiles,
      diff: body.diff,
      autoTest: body.autoTest,
      mlScore: body.mlScore,
      model: doc.aiPolicy.model,
    });

    const submission = await createSubmission({
      challengeId,
      userId: user.id,
      studentName: user.name.trim() || '익명',
      result,
      submittedFiles: body.submittedFiles,
      prompts: body.prompts,
      aiUsage: body.aiUsage,
      integrityLog: body.integrityLog,
    });
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[submissions] 채점/저장 실패', error);
    return Response.json(
      { error: `채점 중 오류가 발생했습니다: ${message}` },
      { status: 502 },
    );
  }
}
