/**
 * route.ts (/api/auth/login) — 이메일/비밀번호 로그인
 *
 * 이메일로 사용자를 찾아 비밀번호 해시를 검증하고, 성공하면 세션 쿠키를 발급한다.
 * 보안을 위해 "이메일 없음"과 "비밀번호 불일치"를 구분하지 않고 동일 메시지로 응답한다.
 *
 * 사용처: features/auth LoginView (authApi.login)
 */
import { findUserByEmail, touchLastLogin, toAuthUser } from '@/shared/lib/db/users';
import { verifyPassword } from '@/shared/lib/auth/password';
import { setSessionCookie } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, password } = (await req.json()) as LoginBody;

    if (!email || !password) {
      return Response.json(
        { error: '이메일과 비밀번호를 입력하세요.' },
        { status: 400 },
      );
    }

    const doc = await findUserByEmail(email);
    const ok = doc ? await verifyPassword(password, doc.passwordHash) : false;
    if (!doc || !ok) {
      return Response.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 },
      );
    }

    const user = toAuthUser(doc);
    await touchLastLogin(user.id);
    await setSessionCookie(user);
    return Response.json({ user });
  } catch (error) {
    logger.error('로그인 실패', error);
    return Response.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
