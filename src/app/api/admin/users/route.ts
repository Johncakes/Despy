/**
 * route.ts (/api/admin/users) — 사용자 목록 (관리자 전용)
 *
 * 관리자가 전체 사용자와 역할을 조회한다(역할 승격 화면의 데이터 출처).
 * requireRole(['admin'])로 인가하며, passwordHash는 매핑 단계에서 제외된다.
 *
 * 사용처: features/admin AdminUsersView (authApi.listUsers)
 */
import { listUsers } from '@/shared/lib/db/users';
import { requireRole, authErrorToResponse } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    await requireRole(['admin']);
    const users = await listUsers();
    return Response.json({ users });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('사용자 목록 조회 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
