/**
 * route.ts (/api/auth/me) — 현재 로그인 사용자 조회
 *
 * 세션 쿠키를 검증해 현재 사용자(AuthUser)를 반환한다. 미로그인 시 user=null을
 * 200으로 응답해, 클라이언트(useCurrentUser)가 "로그인 안 됨"을 정상 상태로 다룰 수
 * 있게 한다(에러로 처리하지 않음).
 *
 * 사용처: shared/core/queries useCurrentUser (authApi.fetchMe)
 */
import { getCurrentUser } from '@/shared/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  return Response.json({ user });
}
