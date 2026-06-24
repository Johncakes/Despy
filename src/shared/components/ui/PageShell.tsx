/**
 * PageShell.tsx — 전체 높이 패딩 컨테이너
 *
 * 앱 화면(교수/학생)을 감싸는 뷰포트 높이 컨테이너. 내부 패널들이 남는 높이를
 * 채우고 각자 스크롤하도록 height/overflow 기준을 잡아준다. 순수 레이아웃 UI.
 *
 * 사용처: app/author, app/solve 의 페이지 컨테이너
 */
'use client';

import styled from 'styled-components';

export const PageShell = styled.div`
  height: 100vh;
  min-height: 0;
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
`;
