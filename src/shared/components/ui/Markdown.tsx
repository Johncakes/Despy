/**
 * Markdown.tsx — 테마가 적용된 마크다운 렌더러
 *
 * react-markdown을 감싸 문제 지문·AI 답변을 렌더링한다. 코드블록/인라인 코드/
 * 제목/목록 등을 테마 토큰 기반으로 스타일링한다. 외부 콘텐츠를 그리므로
 * feature에 의존하지 않는 순수 UI다.
 *
 * 사용처: features/solve(지문, AI 답변), features/author(지문 미리보기)
 */
'use client';

import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

interface MarkdownProps {
  children: string;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <Prose className={className}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </Prose>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Prose = styled.div`
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;

  h1,
  h2,
  h3 {
    margin: ${({ theme }) => `${theme.spacing.md} 0 ${theme.spacing.sm}`};
    font-size: ${({ theme }) => theme.font.sizeMd};
    font-weight: ${({ theme }) => theme.font.weightBold};
  }

  p {
    margin: ${({ theme }) => `${theme.spacing.sm} 0`};
  }

  ul,
  ol {
    margin: ${({ theme }) => `${theme.spacing.sm} 0`};
    padding-left: ${({ theme }) => theme.spacing.lg};
  }

  li {
    margin: ${({ theme }) => theme.spacing.xs} 0;
  }

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: ${({ theme }) => theme.font.sizeXs};
    background: ${({ theme }) => theme.colors.codeBg};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.sm};
    padding: 1px 5px;
  }

  pre {
    margin: ${({ theme }) => `${theme.spacing.sm} 0`};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.codeBg};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.md};
    overflow-x: auto;
  }

  pre code {
    background: none;
    border: none;
    padding: 0;
  }

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: underline;
  }

  strong {
    font-weight: ${({ theme }) => theme.font.weightBold};
  }
`;
