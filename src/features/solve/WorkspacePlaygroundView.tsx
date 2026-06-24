/**
 * WorkspacePlaygroundView.tsx — P0 PoC: WebContainer 부팅·미리보기 검증 화면
 *
 * 샘플 Vite+React 템플릿을 useWorkspace로 부팅→install→dev까지 돌리고 그 결과를
 * WorkspacePanel(미리보기 iframe + 콘솔)로 보여주는 P0 검증용 단독 뷰다.
 * cross-origin isolation 헤더(next.config) → boot → mount → 미리보기까지의
 * 한 줄기가 실제로 동작하는지 확인하는 것이 목적이며, 본 풀이 화면(SolveView)에
 * 워크스페이스를 통합하기 전의 디딤돌이다.
 *
 * 사용처: app/playground/page.tsx
 */
'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { VITE_REACT_SAMPLE_TEMPLATE } from '@/shared/core/constants/webcontainerTemplates';
import { useWorkspace } from '@/features/solve/useWorkspace';
import { WorkspacePanel } from '@/features/solve/components/WorkspacePanel';

// ── Component ─────────────────────────────────────────────────────────────

export function WorkspacePlaygroundView() {
  const { phase, logs, previewUrl, errorMessage, retry } =
    useWorkspace(VITE_REACT_SAMPLE_TEMPLATE);

  return (
    <Wrapper>
      <TopBar>
        <BackLink href="/">← 홈</BackLink>
        <Title>WebContainer PoC</Title>
        <Caption>브라우저 내 Node 런타임에서 Vite+React를 부팅합니다 (P0)</Caption>
      </TopBar>

      <Body>
        <WorkspacePanel
          phase={phase}
          logs={logs}
          previewUrl={previewUrl}
          errorMessage={errorMessage}
          onRetry={retry}
        />
      </Body>
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: ${({ theme }) => theme.spacing.md};
`;

const TopBar = styled.header`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
`;

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
`;

const Caption = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
`;
