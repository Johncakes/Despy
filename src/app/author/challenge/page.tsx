'use client';

import styled from 'styled-components';
import { CombinedAuthorView } from '@/features/author/CombinedAuthorView';
import { Navbar } from '@/shared/components/ui/Navbar';
import { useHasMounted } from '@/shared/lib/hooks/useHasMounted';

export default function ChallengeAuthorPage() {
  const hasMounted = useHasMounted();

  return (
    <DesktopWrapper>
      <Navbar activeTitle="출제 관리" />
      <ContentContainer>
        {hasMounted ? <CombinedAuthorView /> : <Loading>불러오는 중…</Loading>}
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

const Loading = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.md};
`;
