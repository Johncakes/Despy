/**
 * route.ts (/api/auth/logout) — 로그아웃
 *
 * 세션 쿠키를 제거한다. 이후 보호된 라우트 접근은 미들웨어/가드에서 차단된다.
 *
 * 사용처: 홈 헤더 로그아웃 버튼 (authApi.logout)
 */
import { clearSessionCookie } from '@/shared/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
