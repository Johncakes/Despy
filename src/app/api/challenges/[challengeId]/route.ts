/**
 * route.ts (/api/challenges/[challengeId]) — 단일 과제 조회·수정·삭제 (M4 서버 영속)
 *
 * GET: 출제자·admin은 전체(ChallengeProblem), 그 외는 published만 학생 DTO(StudentChallenge).
 *   비공개·미공개 과제는 타인에게 404로 숨긴다. PATCH/DELETE: 교수/admin + 소유권
 *   (challenge.authorId === 본인 || admin)만. 비소유 교수는 403.
 *
 * 사용처: features/author(편집·삭제), features/solve(단일 과제 로드)
 */
import {
  findChallengeDoc,
  toAuthorChallenge,
  toStudentChallenge,
  updateChallenge,
  deleteChallenge,
  type ChallengeInput,
} from '@/shared/lib/db/challenges';
import {
  requireUser,
  requireRole,
  authErrorToResponse,
} from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';
import type { ChallengeStatus } from '@/shared/core/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ challengeId: string }> };

const NOT_FOUND = { error: '과제를 찾을 수 없습니다.' };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  try {
    const user = await requireUser();
    const { challengeId } = await ctx.params;
    const doc = await findChallengeDoc(challengeId);
    if (!doc) return Response.json(NOT_FOUND, { status: 404 });

    const isOwner = doc.authorId === user.id;
    if (isOwner || user.role === 'admin') {
      return Response.json({ challenge: toAuthorChallenge(doc) });
    }
    // 그 외: published만 학생 DTO로. 미공개면 존재를 숨긴다(404).
    if (doc.status !== 'published') {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json({ challenge: toStudentChallenge(doc) });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('과제 조회 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  try {
    const user = await requireRole(['professor', 'admin']);
    const { challengeId } = await ctx.params;
    const doc = await findChallengeDoc(challengeId);
    if (!doc) return Response.json(NOT_FOUND, { status: 404 });
    if (doc.authorId !== user.id && user.role !== 'admin') {
      return Response.json(
        { error: '이 과제를 수정할 권한이 없습니다.' },
        { status: 403 },
      );
    }

    let patch: Partial<ChallengeInput> & { status?: ChallengeStatus };
    try {
      patch = (await req.json()) as Partial<ChallengeInput> & {
        status?: ChallengeStatus;
      };
    } catch {
      return Response.json(
        { error: '요청 본문(JSON) 파싱에 실패했습니다.' },
        { status: 400 },
      );
    }

    // updateChallenge가 허용 필드만 화이트리스트해 authorId 등 변조를 막는다.
    const challenge = await updateChallenge(challengeId, patch);
    if (!challenge) return Response.json(NOT_FOUND, { status: 404 });
    return Response.json({ challenge });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('과제 수정 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<Response> {
  try {
    const user = await requireRole(['professor', 'admin']);
    const { challengeId } = await ctx.params;
    const doc = await findChallengeDoc(challengeId);
    if (!doc) return Response.json(NOT_FOUND, { status: 404 });
    if (doc.authorId !== user.id && user.role !== 'admin') {
      return Response.json(
        { error: '이 과제를 삭제할 권한이 없습니다.' },
        { status: 403 },
      );
    }

    await deleteChallenge(challengeId);
    return Response.json({ ok: true });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('과제 삭제 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
