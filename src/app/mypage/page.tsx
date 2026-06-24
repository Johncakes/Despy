/**
 * page.tsx — 마이페이지 진입점
 *
 * 학생의 풀이 이력·진행률 대시보드(features/mypage/MyPageView)를 렌더한다.
 * 라우팅 진입점 역할만 하며 도메인 로직은 두지 않는다.
 *
 * 사용처: Next.js App Router '/mypage' 경로
 */
import { MyPageView } from '@/features/mypage/MyPageView';

export default function MyPage() {
  return <MyPageView />;
}
