/**
 * page.tsx — 로그인 화면 진입점
 *
 * features/auth의 LoginView를 렌더하는 라우팅 진입점. LoginView가 useSearchParams를
 * 사용하므로 Suspense로 감싼다(Next.js 요구). 도메인 로직은 두지 않는다.
 *
 * 사용처: Next.js App Router '/login'
 */
import { Suspense } from 'react';
import { LoginView } from '@/features/auth/LoginView';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
