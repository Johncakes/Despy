/**
 * route.ts (/api/submissions/mine) — 내 제출 목록 (M4 서버 영속)
 *
 * GET: 로그인 학생 본인의 모든 과제 제출(최신순). 마이페이지의 과제 제출 이력 피드다.
 *   userId(=AuthUser.id)로 스코프하므로 타인 제출은 보이지 않는다.
 *
 * 사용처: features/mypage MyPageView (submissionApi.listMySubmissions)
 */
import { listSubmissionsByUser } from '@/shared/lib/db/submissions';
import { requireUser, authErrorToResponse } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const submissions = await listSubmissionsByUser(user.id);
    return Response.json({ submissions });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('내 제출 목록 조회 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
