/**
 * proxy.ts — 페이지 라우트 인증/인가 게이트 (Edge, Next.js 16 proxy 컨벤션)
 *
 * Next.js 16에서 middleware는 proxy로 이름이 바뀌었다. 보호된 페이지 진입 시 세션
 * 쿠키를 검증해 미인증/권한부족이면 리다이렉트한다.
 * - /author/*  → professor·admin (출제·채점)
 * - /admin/*   → admin (사용자 관리)
 * - /solve/*, /workspace/*, /playground → 로그인 필요
 * 역할은 JWT 클레임에서 읽으므로 DB 조회가 없다(verifySession은 jose 기반 — Edge 호환).
 *
 * API 라우트는 핸들러 내부 가드(requireUser/requireRole)로 처리하므로 matcher에서 제외한다.
 * COOP/COEP 헤더는 next.config.ts headers()가 담당한다(여기선 다루지 않음).
 *
 * 사용처: Next.js 전역 proxy(구 middleware)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/shared/lib/auth/jwt';
import type { UserRole } from '@/shared/core/types';

// ── 경로별 접근 정책 ──────────────────────────────────────────────────────────

/** prefix가 일치하면 해당 역할이 필요. 정의 순서대로(구체적인 것 먼저) 검사한다. */
const ROLE_RULES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/author', roles: ['professor', 'admin'] },
];

/** 로그인만 필요한(역할 무관) 경로 prefix. */
const AUTH_ONLY_PREFIXES = ['/solve', '/workspace', '/playground'];

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const roleRule = ROLE_RULES.find((rule) => pathname.startsWith(rule.prefix));
  const needsAuthOnly = AUTH_ONLY_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!roleRule && !needsAuthOnly) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySession(token) : null;

  if (!user) {
    return redirectToLogin(request);
  }
  if (roleRule && !roleRule.roles.includes(user.role)) {
    // 권한 부족 — 홈으로 돌려보낸다(로그인은 돼 있으므로 /login 루프 방지).
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/author/:path*',
    '/admin/:path*',
    '/solve/:path*',
    '/workspace/:path*',
    '/playground',
  ],
};
