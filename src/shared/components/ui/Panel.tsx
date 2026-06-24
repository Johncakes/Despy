/**
 * Panel.tsx — 제목/액션을 가진 표면(surface) 카드 컨테이너
 *
 * 문제 지문·에디터·채팅·채점 결과 등 화면 영역을 감싸는 기본 패널. 선택적
 * 헤더(제목 + 우측 액션)와 스크롤 가능한 본문을 제공한다. 부모가 높이를 주면
 * 본문이 남는 공간을 채우며 스크롤된다. feature를 import하지 않는 순수 UI.
 *
 * 사용처: features/solve, features/author 의 영역 컨테이너
 */
'use client';

import styled from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

interface PanelProps {
  title?: React.ReactNode;
  /** 헤더 우측 액션 영역 */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** 본문 패딩 제거 (에디터처럼 가장자리까지 채우는 경우) */
  isBodyFlush?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function Panel({ title, actions, children, isBodyFlush = false, className }: PanelProps) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <Container className={className}>
      {hasHeader && (
        <Header>
          <Title>{title}</Title>
          {actions !== undefined && <Actions>{actions}</Actions>}
        </Header>
      )}
      <Body $flush={isBodyFlush}>{children}</Body>
    </Container>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Container = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const Title = styled.div`
  font-weight: ${({ theme }) => theme.font.weightBold};
  font-size: ${({ theme }) => theme.font.sizeMd};
  flex-shrink: 0;
  white-space: nowrap;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;

const Body = styled.div<{ $flush: boolean }>`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme, $flush }) => ($flush ? '0' : theme.spacing.md)};
`;
