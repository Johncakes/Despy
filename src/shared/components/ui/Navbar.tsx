/**
 * Navbar.tsx — 공통 상단 네비게이션 바
 *
 * 모든 대시보드, 관리자/교수 관리 화면, 마이페이지, 플레이그라운드에서 공통으로
 * 사용하는 데스크톱 앱 스타일의 상단 네비게이션 헤더. 로그인 정보, 마케팅 로고,
 * 역할 기반 링크(과제 출제, 알고리즘 출제, 사용자 관리)를 단일 인터페이스로 묶어 제공한다.
 * 풀이 화면(Solve/Workspace) 및 인증 화면(Login/Signup)은 집중도를 위해 제외된다.
 *
 * 사용처: app/page, features/mypage, features/author, features/admin 등
 */
'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { useCurrentUser, useLogout } from '@/shared/core/queries/authQueries';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';
import { Button } from '@/shared/components/ui/Button';

interface NavbarProps {
  /** 현재 활성화된 메뉴/경로 레이블 (예: "Dashboard", "마이페이지") */
  activeTitle?: string;
}

export function Navbar({ activeTitle = 'Dashboard' }: NavbarProps) {
  const hasMounted = useHasMounted();
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();

  const isAuthor = currentUser?.role === 'professor' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <Header>
      <NavBrand>
        <Link href="/">
          <Logo>despy</Logo>
        </Link>
        <BrandDivider />
        <NavTitle>{activeTitle}</NavTitle>
      </NavBrand>
      <NavActions>
        {/* Main Navigation Links */}
        <NavLink href="/playground">놀이터</NavLink>
        <NavLink href="/mypage">마이페이지</NavLink>
        {isAuthor && (
          <NavLink href="/author">문제 출제</NavLink>
        )}
        {isAdmin && (
          <NavLink href="/admin/users">사용자 관리</NavLink>
        )}

        <NavDivider />

        {/* User Account Info & Authentication */}
        {hasMounted && currentUser && (
          <UserTag>
            {currentUser.name}
            <RoleTag $role={currentUser.role}>
              {currentUser.role === 'admin'
                ? '관리자'
                : currentUser.role === 'professor'
                  ? '교수'
                  : '학생'}
            </RoleTag>
          </UserTag>
        )}
        {hasMounted && currentUser ? (
          <Button variant="ghost" onClick={() => logout.mutate()}>
            로그아웃
          </Button>
        ) : (
          <Link href="/login">
            <Button variant="primary">로그인</Button>
          </Link>
        )}
      </NavActions>
    </Header>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Header = styled.header`
  height: 50px;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  flex-shrink: 0;
  z-index: 10;
`;

const NavBrand = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Logo = styled.span`
  font-size: 20px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: -0.5px;
  cursor: pointer;
`;

const BrandDivider = styled.div`
  width: 1px;
  height: 16px;
  background: ${({ theme }) => theme.colors.border};
`;

const NavTitle = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const NavLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  transition: all 0.15s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

const NavDivider = styled.div`
  width: 1px;
  height: 16px;
  background: ${({ theme }) => theme.colors.border};
`;

const UserTag = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const RoleTag = styled.span<{ $role: string }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 800;
  background: ${({ theme, $role }) =>
    $role === 'admin'
      ? `${theme.colors.danger}15`
      : $role === 'professor'
        ? `${theme.colors.primary}15`
        : `${theme.colors.success}15`};
  color: ${({ theme, $role }) =>
    $role === 'admin'
      ? theme.colors.danger
      : $role === 'professor'
        ? theme.colors.primary
        : theme.colors.success};
  border: 1px solid ${({ theme, $role }) =>
    $role === 'admin'
      ? `${theme.colors.danger}33`
      : $role === 'professor'
        ? `${theme.colors.primary}33`
        : `${theme.colors.success}33`};
`;
