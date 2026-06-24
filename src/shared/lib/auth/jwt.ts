/**
 * jwt.ts — 세션 JWT 서명/검증 (jose)
 *
 * 로그인 성공 시 사용자 식별·역할을 담은 JWT를 발급하고, 이후 요청에서 이 토큰을
 * 검증해 현재 사용자를 복원한다. jose는 Edge 런타임(미들웨어)에서도 동작하므로
 * 라우트 핸들러(nodejs)와 미들웨어(edge) 양쪽에서 동일한 코드를 쓴다.
 *
 * 역할(role)을 토큰에 담으므로 미들웨어가 DB 조회 없이 게이팅할 수 있다. 단 역할
 * 변경(승격)은 재로그인(토큰 재발급) 후 반영된다 — 토대 단계에서 수용한 절충이다.
 *
 * 사용처: shared/lib/auth/session.ts, src/middleware.ts (서버 전용)
 */
import { SignJWT, jwtVerify } from 'jose';
import type { AuthUser, UserRole } from '@/shared/core/types';

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * 세션 쿠키 이름. session.ts(라우트 핸들러)와 middleware.ts(Edge)가 공유한다.
 * Edge 미들웨어가 next/headers를 import하는 session.ts를 끌어오지 않도록, 쿠키
 * 이름은 next/headers 의존이 없는 이 모듈(jwt.ts)에 둔다.
 */
export const SESSION_COOKIE = 'despy_session';

/** 토큰 만료 — 7일. */
const EXPIRATION = '7d';
const ALG = 'HS256';

// ── Types ─────────────────────────────────────────────────────────────────

/** JWT 페이로드(세션 클레임). sub=userId. */
export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '환경 변수 JWT_SECRET이 설정되지 않았습니다. .env.local을 확인하세요.',
    );
  }
  return new TextEncoder().encode(secret);
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/** AuthUser로 세션 JWT를 서명해 발급한다. */
export async function signSession(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

/**
 * 세션 JWT를 검증해 AuthUser를 복원한다. 서명 불일치·만료·형식 오류면 null.
 * (검증 실패를 throw 대신 null로 다뤄 호출부 가드를 단순화한다.)
 */
export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}
