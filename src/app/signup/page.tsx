/**
 * page.tsx — 회원가입 화면 진입점
 *
 * features/auth의 SignupView를 렌더하는 라우팅 진입점. 도메인 로직은 두지 않는다.
 *
 * 사용처: Next.js App Router '/signup'
 */
import { SignupView } from '@/features/auth/SignupView';

export default function SignupPage() {
  return <SignupView />;
}
