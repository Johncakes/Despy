/**
 * route.ts (/api/auth/signup) — 이메일/비밀번호 회원가입
 *
 * 누구나 이메일·이름·비밀번호로 가입한다. 신규 가입자는 기본 역할 'student'이며,
 * 교수 권한은 관리자가 별도로 승격한다(/api/admin/users). 비밀번호는 해시해서만
 * 저장하고, 성공 시 세션 쿠키를 발급해 바로 로그인 상태가 된다.
 *
 * 사용처: features/auth SignupView (authApi.signup)
 */
import { findUserByEmail, createUser } from '@/shared/lib/db/users';
import { hashPassword } from '@/shared/lib/auth/password';
import { setSessionCookie } from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

interface SignupBody {
  email?: string;
  name?: string;
  password?: string;
}

/** 비밀번호 최소 길이 — 토대 단계의 단순 정책. */
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  try {
    const { email, name, password } = (await req.json()) as SignupBody;

    if (!email || !EMAIL_PATTERN.test(email)) {
      return Response.json({ error: '올바른 이메일을 입력하세요.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return Response.json({ error: '이름을 입력하세요.' }, { status: 400 });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return Response.json(
        { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` },
        { status: 400 },
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return Response.json({ error: '이미 가입된 이메일입니다.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, name, passwordHash, role: 'student' });

    await setSessionCookie(user);
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    logger.error('회원가입 실패', error);
    return Response.json({ error: '회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
