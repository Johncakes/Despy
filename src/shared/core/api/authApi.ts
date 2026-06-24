/**
 * authApi.ts — 인증·사용자 데이터 접근 (/api/auth, /api/admin 호출)
 *
 * 로그인/가입/로그아웃/현재 사용자 조회와 관리자용 사용자 목록·역할 변경 fetch를
 * 한 곳에 격리한다. 컴포넌트는 직접 fetch하지 않고 이 모듈(→ authQueries 훅)만 쓴다.
 * 세션은 HttpOnly 쿠키로 오가므로 토큰을 클라이언트에서 다루지 않는다(credentials 동일출처).
 *
 * 사용처: shared/core/queries/authQueries
 */
import type { AuthUser, UserRole } from '@/shared/core/types';

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/** JSON 응답을 파싱하고, 실패 응답이면 서버 error 메시지로 throw한다. */
async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    const message = data?.error || `요청 실패 (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

// ── 인증 ───────────────────────────────────────────────────────────────────

/** 회원가입. 성공 시 세션 쿠키가 발급되어 바로 로그인 상태가 된다. */
export async function signup(params: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthUser> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const { user } = await parseJson<{ user: AuthUser }>(response);
  return user;
}

/** 로그인. */
export async function login(params: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const { user } = await parseJson<{ user: AuthUser }>(response);
  return user;
}

/** 로그아웃(세션 쿠키 제거). */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

/** 현재 로그인 사용자를 조회한다(미로그인 시 null). */
export async function fetchMe(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me');
  const { user } = await parseJson<{ user: AuthUser | null }>(response);
  return user;
}

// ── 관리자 ─────────────────────────────────────────────────────────────────

/** 전체 사용자 목록(관리자 전용). */
export async function listUsers(): Promise<AuthUser[]> {
  const response = await fetch('/api/admin/users');
  const { users } = await parseJson<{ users: AuthUser[] }>(response);
  return users;
}

/** 사용자 역할 변경(관리자 전용). */
export async function updateUserRole(params: {
  userId: string;
  role: UserRole;
}): Promise<AuthUser> {
  const response = await fetch(`/api/admin/users/${params.userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: params.role }),
  });
  const { user } = await parseJson<{ user: AuthUser }>(response);
  return user;
}
