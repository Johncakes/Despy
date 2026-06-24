/**
 * AiChatPanel.tsx — 제한된 AI 도우미 패널
 *
 * 교수 정책(모델 고정·질문/토큰 한도·시스템 프롬프트) 아래에서만 동작하는 AI
 * 채팅. useChat로 /api/agent에 스트리밍 요청하고, 응답 종료 시 토큰 사용량을
 * 받아 한도를 차감한다(onTurnComplete). 한도 소진 시 입력이 비활성화된다.
 * 접힘(isOpen=false) 상태에서도 마운트를 유지해 대화 기록이 보존된다.
 *
 * 사용처: features/solve/SolveView
 */
'use client';

import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { Problem, AgentUsageMetadata } from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { QuotaMeter } from '@/shared/components/ui/QuotaMeter';
import { Markdown } from '@/shared/components/ui/Markdown';

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_OUTPUT_TOKENS_CAP = 2048;

// ── Types ─────────────────────────────────────────────────────────────────

interface AiChatPanelProps {
  problem: Problem;
  questionsUsed: number;
  tokensUsed: number;
  isOpen: boolean;
  onToggle: () => void;
  /** 응답 1턴 완료 시 호출 (질문 +1, 토큰 누적) */
  onTurnComplete: (totalTokens: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function AiChatPanel({
  problem,
  questionsUsed,
  tokensUsed,
  isOpen,
  onToggle,
  onTurnComplete,
}: AiChatPanelProps) {
  const policy = problem.aiPolicy;
  const remainingQuestions = Math.max(policy.maxQuestions - questionsUsed, 0);
  const remainingTokens = Math.max(policy.maxTokens - tokensUsed, 0);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/agent' }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      const usage = message.metadata as AgentUsageMetadata | undefined;
      onTurnComplete(usage?.totalTokens ?? 0);
    },
  });

  const [input, setInput] = useState('');
  const isBusy = status === 'submitted' || status === 'streaming';
  const isQuotaExhausted = remainingQuestions <= 0 || remainingTokens <= 0;
  const canSend = input.trim().length > 0 && !isBusy && !isQuotaExhausted;

  const handleSend = () => {
    if (!canSend) return;
    const text = input;
    setInput('');
    sendMessage(
      { text },
      {
        body: {
          systemPrompt: policy.systemPrompt,
          model: policy.model,
          maxOutputTokens: Math.min(remainingTokens, MAX_OUTPUT_TOKENS_CAP),
        },
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <CollapsedBar type="button" onClick={onToggle} aria-label="AI 도우미 열기">
        <CollapsedText>AI 도우미</CollapsedText>
      </CollapsedBar>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderTitle>
          AI 도우미
          <Badge tone="info">{policy.model}</Badge>
        </HeaderTitle>
        <Button variant="ghost" onClick={onToggle}>
          닫기
        </Button>
      </Header>

      <Quota>
        <QuotaMeter label="질문 횟수" used={questionsUsed} max={policy.maxQuestions} unit="회" />
        <QuotaMeter label="토큰" used={tokensUsed} max={policy.maxTokens} unit="토큰" />
      </Quota>

      <Messages>
        {messages.length === 0 && (
          <EmptyHint>
            막힌 부분을 물어보세요. 답변 정책은 교수가 설정한 가드레일을 따릅니다.
          </EmptyHint>
        )}
        {messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('');
          return (
            <Bubble key={message.id} $role={message.role}>
              {message.role === 'assistant' ? (
                <Markdown>{text}</Markdown>
              ) : (
                <UserText>{text}</UserText>
              )}
            </Bubble>
          );
        })}
        {error && <ErrorText>오류가 발생했습니다: {error.message}</ErrorText>}
      </Messages>

      <Composer>
        {isQuotaExhausted ? (
          <ExhaustedNotice>한도를 모두 사용했습니다. 남은 정보로 직접 풀어보세요.</ExhaustedNotice>
        ) : (
          <>
            <ComposerInput
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="AI에게 질문하기 (Enter 전송 · Shift+Enter 줄바꿈)"
              rows={3}
              disabled={isBusy}
            />
            <Button variant="primary" onClick={handleSend} disabled={!canSend}>
              {isBusy ? '응답 중…' : '전송'}
            </Button>
          </>
        )}
      </Composer>
    </Container>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Container = styled.aside`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  width: 380px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

const CollapsedBar = styled.button`
  width: 44px;
  height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

const CollapsedText = styled.span`
  writing-mode: vertical-rl;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  letter-spacing: 2px;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: ${({ theme }) => theme.font.weightBold};
`;

const Quota = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Messages = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
`;

const EmptyHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Bubble = styled.div<{ $role: 'system' | 'user' | 'assistant' }>`
  align-self: ${({ $role }) => ($role === 'user' ? 'flex-end' : 'flex-start')};
  max-width: 90%;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $role }) =>
    $role === 'user' ? theme.colors.primary : theme.colors.surfaceAlt};
  color: ${({ theme, $role }) =>
    $role === 'user' ? theme.colors.background : theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const UserText = styled.div`
  font-size: ${({ theme }) => theme.font.sizeSm};
  white-space: pre-wrap;
  word-break: break-word;
`;

const ErrorText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
`;

const Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const ComposerInput = styled.textarea`
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: inherit;
  resize: none;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const ExhaustedNotice = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.warning};
`;
