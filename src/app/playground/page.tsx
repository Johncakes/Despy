'use client';

import styled from 'styled-components';
import { WorkspacePlaygroundView } from '@/features/solve/WorkspacePlaygroundView';
import { Navbar } from '@/shared/components/ui/Navbar';

export default function PlaygroundPage() {
  return (
    <DesktopWrapper>
      <Navbar activeTitle="놀이터" />
      <ContentContainer>
        <WorkspacePlaygroundView />
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
  min-height: 0;
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
`;
