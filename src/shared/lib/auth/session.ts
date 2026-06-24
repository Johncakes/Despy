/**
 * session.ts — 세션 쿠키 + 라우트 핸들러 인가 가드
 *
 * 세션 JWT를 HttpOnly 쿠키로 발급/해제하고, 라우트 핸들러에서 현재 사용자를
 * 복원·인가한다. requireUser/requireRole는 미인증/권한부족 시 AuthError를 던지며,
 * 호출부는 authErrorToResponse로 적절한 상태코드(401/403) 응답으로 변환한다.
 *
 * 쿠키 읽기/쓰기는 next/headers의 cookies()를 사용한다(라우트 핸들러·서버 액션 전용).
 * 미들웨어(edge)는 request.cookies로 직접 읽으므로 이 모듈을 import하지 않는다.
 *
 * 사용처: app/api/auth/*, app/api/admin/*, 보호된 기존 라우트(서버 전용)
 */
import { cookies } from 'next/headers';
import { signSession, verifySession, SESSION_COOKIE } from '@/shared/lib/auth/jwt';
import type { AuthUser, UserRole } from '@/shared/core/types';

// 쿠키 이름은 jwt.ts(Edge 안전)에서 단일 정의하고 여기서 재노출한다.
export { SESSION_COOKIE };

// ── Constants ───────────────────────────────────────────────────────────────

/** 토큰 만료(jwt.ts)와 맞춘 쿠키 maxAge — 7일(초). */
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

// ── 인가 에러 ─────────────────────────────────────────────────────────────────

/** 인증/인가 실패. status로 401(미인증)·403(권한부족)을 구분한다. */
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** AuthError면 그에 맞는 JSON 응답을, 아니면 undefined를 반환한다(호출부에서 재처리). */
export function authErrorToResponse(error: unknown): Response | undefined {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return undefined;
}

// ── 쿠키 발급/해제 ─────────────────────────────────────────────────────────────

/** 로그인 성공 시 세션 JWT를 서명해 HttpOnly 쿠키로 심는다. */
export async function setSessionCookie(user: AuthUser): Promise<void> {
  const token = await signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
}

/** 로그아웃 시 세션 쿠키를 제거한다. */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ── 현재 사용자 / 가드 ─────────────────────────────────────────────────────────

/** 세션 쿠키에서 현재 사용자를 복원한다(없거나 무효면 null). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** 로그인 필수 가드. 미인증이면 AuthError(401). */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, '로그인이 필요합니다.');
  return user;
}

/** 역할 가드. 허용 역할이 아니면 AuthError(403). */
export async function requireRole(roles: UserRole[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError(403, '이 작업을 수행할 권한이 없습니다.');
  }
  return user;
}
