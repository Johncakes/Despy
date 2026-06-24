'use client';

import styled from 'styled-components';
import { AdminUsersView } from '@/features/admin/AdminUsersView';
import { Navbar } from '@/shared/components/ui/Navbar';

export default function AdminUsersPage() {
  return (
    <DesktopWrapper>
      <Navbar activeTitle="사용자 관리" />
      <ContentContainer>
        <AdminUsersView />
      </ContentContainer>
    </DesktopWrapper>
  );
}

const DesktopWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: ${({ theme }) => theme.colors.background};
`;

const ContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;
