/**
 * AiChatPanel.tsx — 제한된 AI 도우미 패널
 *
 * 교수 정책(모델 고정·질문/토큰 한도·시스템 프롬프트) 아래에서만 동작하는 AI
 * 채팅. useChat로 /api/agent에 스트리밍 요청하고, 응답 종료 시 토큰 사용량을
 * 받아 한도를 차감한다(onTurnComplete). 한도 소진 시 입력이 비활성화된다.
 * 접힘(isOpen=false) 상태에서도 마운트를 유지해 대화 기록이 보존된다.
 *
 * 코드 안정 반영: '직접 편집'이 켜져 있으면 답변에서 **완성된 "파일 전체" 코드블록만**
 * 추출(extractCompletedFileEdit)해 콜백(onAiCodeStream)으로 에디터에 반영한다. 부분
 * 스니펫·쉘 명령·작성 중 블록은 걸러져 파일이 조각으로 덮어써지지 않는다. 또한 전송 시
 * applyFullFile 플래그로 서버가 "전체 파일 출력 계약"을 AI에 덧붙이게 해 AI가 처음부터
 * 파일 전체를 내도록 유도한다. 적용 직전 onAiCodeStreamStart(스냅샷), 종료 시
 * onAiCodeStreamEnd를 호출한다.
 *
 * 코드 첨부(선택): getCodeContext가 주어지고 '코드 첨부' 토글이 켜져 있으면, 질문을
 * 보낼 때 현재 코드 상태를 메시지 뒤에 덧붙여 AI가 맥락을 보고 답하게 한다. 첨부분은
 * 학생이 보낸 user 메시지로 전달되며(시스템 프롬프트로 승격하지 않아 가드레일 우회
 * 위험을 피한다), 말풍선에는 질문만 표시하고 첨부 여부는 작은 칩으로만 알린다.
 *
 * AI 정책만 의존하므로 prop으로 `aiPolicy`만 받는다(구 Problem·신 ChallengeProblem
 * 양쪽에서 재사용 — 특정 문제 모델에 결합하지 않는다).
 *
 * 사용처: features/solve/SolveView(구), features/solve/ChallengeSolveView(피벗)
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { AiPolicy, AgentUsageMetadata } from '@/shared/core/types';
import { extractCompletedFileEdit } from '@/shared/lib/utils/markdownCode';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { QuotaMeter } from '@/shared/components/ui/QuotaMeter';
import { Markdown } from '@/shared/components/ui/Markdown';

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_OUTPUT_TOKENS_CAP = 2048;

/**
 * 질문 뒤에 붙이는 코드 첨부 구분자. 전송 텍스트에는 포함되지만(AI는 봄),
 * 말풍선 렌더 시 이 구분자 앞부분(질문)만 보여주고 뒷부분(코드)은 칩으로 숨긴다.
 */
const CODE_CONTEXT_DELIMITER = '\n\n[despy:현재 코드 상태]\n';

// ── Types ─────────────────────────────────────────────────────────────────

interface AiChatPanelProps {
  /** 교수가 설정한 AI 가드레일(모델·질문/토큰 한도·시스템 프롬프트) */
  aiPolicy: AiPolicy;
  questionsUsed: number;
  tokensUsed: number;
  isOpen: boolean;
  onToggle: () => void;
  /** 응답 1턴 완료 시 호출 (질문 +1, 토큰 누적) */
  onTurnComplete: (totalTokens: number) => void;
  /** AI가 에디터를 직접 편집할지 여부 */
  isDirectEditEnabled: boolean;
  onToggleDirectEdit: () => void;
  /** 이번 답변에서 코드 적용을 시작할 때 1회 (부모가 현재 코드 스냅샷 — 되돌리기용) */
  onAiCodeStreamStart: () => void;
  /**
   * 완성된 전체 파일을 에디터에 반영한다. path가 주어지면 그 파일에, null이면 활성
   * 파일에 적용한다(부분 스니펫·쉘 명령은 호출되지 않음 — markdownCode가 걸러냄).
   */
  onAiCodeStream: (code: string, path: string | null) => void;
  /** 스트리밍 종료 (부모가 '작성 중' 해제) */
  onAiCodeStreamEnd: () => void;
  /**
   * 현재 코드 상태를 마크다운 문자열로 반환한다(전송 시점에 호출). 주어지면 '코드 첨부'
   * 토글이 노출되어, 켜져 있을 때 질문 뒤에 이 문자열을 덧붙여 보낸다. 없으면 토글 미노출.
   */
  getCodeContext?: () => string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 전송 텍스트를 [질문, 첨부된 코드(없으면 null)]로 분리한다 — 말풍선에 질문만
 * 보여주고 코드 첨부 여부는 칩으로만 표시하기 위함이다.
 */
function splitQuestionAndContext(text: string): [string, string | null] {
  const index = text.indexOf(CODE_CONTEXT_DELIMITER);
  if (index === -1) return [text, null];
  return [text.slice(0, index), text.slice(index + CODE_CONTEXT_DELIMITER.length)];
}

// ── Component ─────────────────────────────────────────────────────────────

export function AiChatPanel({
  aiPolicy,
  questionsUsed,
  tokensUsed,
  isOpen,
  onToggle,
  onTurnComplete,
  isDirectEditEnabled,
  onToggleDirectEdit,
  onAiCodeStreamStart,
  onAiCodeStream,
  onAiCodeStreamEnd,
  getCodeContext,
}: AiChatPanelProps) {
  const policy = aiPolicy;
  const remainingQuestions = Math.max(policy.maxQuestions - questionsUsed, 0);
  const remainingTokens = Math.max(policy.maxTokens - tokensUsed, 0);
  // 코드 첨부는 부모가 getCodeContext를 줄 때만 노출한다. 기본 ON(맥락 제공이 목적).
  const canAttachCode = typeof getCodeContext === 'function';
  const [isAttachCodeEnabled, setIsAttachCodeEnabled] = useState(true);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/agent' }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      const usage = message.metadata as AgentUsageMetadata | undefined;
      onTurnComplete(usage?.totalTokens ?? 0);
      onAiCodeStreamEnd();
    },
  });

  const [input, setInput] = useState('');
  const isBusy = status === 'submitted' || status === 'streaming';
  const isQuotaExhausted = remainingQuestions <= 0 || remainingTokens <= 0;
  const canSend = input.trim().length > 0 && !isBusy && !isQuotaExhausted;

  // ── 코드 반영(완성된 전체 파일만) ────────────────────────────────────────
  // 마지막 assistant 메시지 텍스트(스트리밍 중 자람)에서 "완성된 전체 파일"만 추출해
  // 에디터에 반영한다. 부분 스니펫·쉘 명령·작성 중 블록은 markdownCode가 걸러내므로
  // 파일이 조각으로 덮어써지지 않는다(안정 반영). 값 비교로 동작 → useMemo 불필요.
  let lastAssistantText: string | null = null;
  let lastAssistantId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    lastAssistantId = message.id;
    lastAssistantText = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
    break;
  }

  // 메시지별로 "스냅샷(되돌리기 기준)"을 1회만 찍기 위한 추적 ref
  const snapshotMessageIdRef = useRef<string | null>(null);
  // 같은 내용을 중복 반영하지 않도록 마지막 적용분을 기억한다(메시지 id + 내용).
  const appliedEditRef = useRef<{ id: string; content: string } | null>(null);

  useEffect(() => {
    if (!isDirectEditEnabled) return;
    if (lastAssistantText === null || lastAssistantId === null) return;
    const edit = extractCompletedFileEdit(lastAssistantText);
    if (edit === null) return; // 적용할 완성 파일 없음 → 에디터 건드리지 않음
    // 동일 메시지에서 같은 내용을 이미 반영했으면 스킵(반복 write 방지).
    const applied = appliedEditRef.current;
    if (applied && applied.id === lastAssistantId && applied.content === edit.content) {
      return;
    }
    if (snapshotMessageIdRef.current !== lastAssistantId) {
      snapshotMessageIdRef.current = lastAssistantId;
      onAiCodeStreamStart(); // 덮어쓰기 직전 현재 코드 스냅샷(되돌리기용)
    }
    appliedEditRef.current = { id: lastAssistantId, content: edit.content };
    onAiCodeStream(edit.content, edit.path);
  }, [
    isDirectEditEnabled,
    lastAssistantText,
    lastAssistantId,
    onAiCodeStreamStart,
    onAiCodeStream,
  ]);

  const handleSend = () => {
    if (!canSend) return;
    const question = input;
    setInput('');
    // 코드 첨부가 켜져 있으면 현재 코드 상태를 질문 뒤에 덧붙인다. user 메시지로
    // 전달되므로 시스템 프롬프트(가드레일)를 건드리지 않는다.
    const codeContext =
      canAttachCode && isAttachCodeEnabled ? getCodeContext?.() : undefined;
    const text = codeContext
      ? `${question}${CODE_CONTEXT_DELIMITER}${codeContext}`
      : question;
    sendMessage(
      { text },
      {
        body: {
          systemPrompt: policy.systemPrompt,
          model: policy.model,
          maxOutputTokens: Math.min(remainingTokens, MAX_OUTPUT_TOKENS_CAP),
          // 직접 편집(자동 반영)이 켜져 있으면 서버가 "전체 파일 출력 계약"을 시스템에
          // 덧붙여, AI가 부분 조각 대신 파일 전체를 한 블록으로 내도록 유도한다.
          applyFullFile: isDirectEditEnabled,
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

      <Controls>
        <ToggleLabel>
          <input
            type="checkbox"
            checked={isDirectEditEnabled}
            onChange={onToggleDirectEdit}
          />
          AI 직접 편집 (코드를 에디터에 실시간 작성)
        </ToggleLabel>
        {canAttachCode && (
          <ToggleLabel>
            <input
              type="checkbox"
              checked={isAttachCodeEnabled}
              onChange={() => setIsAttachCodeEnabled((enabled) => !enabled)}
            />
            현재 코드 첨부 (질문에 지금 코드 상태를 함께 전송)
          </ToggleLabel>
        )}
      </Controls>

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
          // user 메시지는 첨부된 코드 상태를 숨기고 질문만 보여준다(첨부 여부는 칩).
          const [question, attachedCode] = splitQuestionAndContext(text);
          return (
            <Bubble key={message.id} $role={message.role}>
              {message.role === 'assistant' ? (
                <Markdown>{text}</Markdown>
              ) : (
                <>
                  <UserText>{question}</UserText>
                  {attachedCode !== null && (
                    <AttachedChip>📎 현재 코드 첨부됨</AttachedChip>
                  )}
                </>
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
  width: 100%;
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

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ToggleLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
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

// 코드가 첨부된 user 메시지에 다는 작은 표식(코드 본문은 말풍선에 노출하지 않음).
const AttachedChip = styled.span`
  display: inline-flex;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeXs};
  opacity: 0.8;
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
