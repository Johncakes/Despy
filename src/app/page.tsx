/**
 * page.tsx — 랜딩 페이지 (스타터 플레이스홀더)
 *
 * 초기 세팅 확인용 시작 화면. 실제 도메인(교수/학생 플로우)은 features/에
 * 구현하고 이 페이지는 라우팅 진입점 역할만 한다.
 *
 * 사용처: Next.js App Router '/' 경로
 */
'use client';

import styled from 'styled-components';
import { Button } from '@/shared/components/ui/Button';

export default function HomePage() {
  return (
    <Main>
      <Title>despy</Title>
      <Subtitle>에이전틱 코딩 평가 시스템 — 초기 세팅 완료</Subtitle>
      <Actions>
        <Button variant="primary">시작하기</Button>
        <Button variant="ghost">문서 보기</Button>
      </Actions>
    </Main>
  );
}

// ── Styled Components ─────────────────────────────────────────────────
const Main = styled.main`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl};
`;

const Title = styled.h1`
  margin: 0;
  font-size: 48px;
  color: ${({ theme }) => theme.colors.primary};
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`;
