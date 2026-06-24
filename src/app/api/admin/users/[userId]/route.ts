/**
 * route.ts (/api/admin/users/[userId]) — 사용자 역할 변경 (관리자 전용)
 *
 * 관리자가 특정 사용자의 역할(student/professor/admin)을 변경한다. 자기 자신의
 * 역할은 바꿀 수 없게 막아 실수로 관리자 권한을 잃는(락아웃) 상황을 방지한다.
 *
 * 사용처: features/admin AdminUsersView (authApi.updateUserRole)
 */
import { updateUserRole } from '@/shared/lib/db/users';
import { requireRole, authErrorToResponse } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';
import type { UserRole } from '@/shared/core/types';

export const runtime = 'nodejs';

interface UpdateRoleBody {
  role?: UserRole;
}

const VALID_ROLES: UserRole[] = ['student', 'professor', 'admin'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  try {
    const admin = await requireRole(['admin']);
    const { userId } = await params;
    const { role } = (await req.json()) as UpdateRoleBody;

    if (!role || !VALID_ROLES.includes(role)) {
      return Response.json({ error: '올바르지 않은 역할입니다.' }, { status: 400 });
    }
    if (userId === admin.id) {
      return Response.json(
        { error: '자기 자신의 역할은 변경할 수 없습니다.' },
        { status: 400 },
      );
    }

    const user = await updateUserRole(userId, role);
    if (!user) {
      return Response.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }
    return Response.json({ user });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('역할 변경 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
