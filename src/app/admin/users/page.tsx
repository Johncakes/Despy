/**
 * page.tsx — 사용자 관리 화면 진입점 (관리자 전용)
 *
 * features/admin의 AdminUsersView를 렌더하는 라우팅 진입점. 접근 제한은 미들웨어가
 * admin 역할로 강제한다. 도메인 로직은 두지 않는다.
 *
 * 사용처: Next.js App Router '/admin/users'
 */
import { AdminUsersView } from '@/features/admin/AdminUsersView';

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
