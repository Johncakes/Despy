/**
 * route.ts (/api/submissions/[submissionId]) — 단일 제출 조회 (M4 서버 영속)
 *
 * GET: 제출 본인(userId)·부모 과제 출제자(challenge.authorId)·admin만 열람한다.
 *   교차 테넌트(타 학생·비소유 교수)는 403. 대시보드 행 클릭 시 상세(코드·대화·diff) 로드용.
 *
 * 사용처: features/author GradingDashboardView 상세 모달, features/solve 결과 재조회
 */
import { findSubmissionDoc, toSubmission } from '@/shared/lib/db/submissions';
import { findChallengeDoc } from '@/shared/lib/db/challenges';
import { requireUser, authErrorToResponse } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ submissionId: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  try {
    const user = await requireUser();
    const { submissionId } = await ctx.params;

    const doc = await findSubmissionDoc(submissionId);
    if (!doc) {
      return Response.json({ error: '제출을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = doc.userId === user.id;
    const isAdmin = user.role === 'admin';
    let isParentAuthor = false;
    if (!isOwner && !isAdmin) {
      const challenge = await findChallengeDoc(doc.challengeId.toHexString());
      isParentAuthor = challenge?.authorId === user.id;
    }
    if (!isOwner && !isAdmin && !isParentAuthor) {
      return Response.json(
        { error: '이 제출을 조회할 권한이 없습니다.' },
        { status: 403 },
      );
    }

    return Response.json({ submission: toSubmission(doc) });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('제출 조회 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
