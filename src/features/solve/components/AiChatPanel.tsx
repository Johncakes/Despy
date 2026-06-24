/**
 * AiChatPanel.tsx — 제한된 AI 도우미 패널
 *
 * 교수 정책(모델 고정·질문/토큰 한도·시스템 프롬프트) 아래에서만 동작하는 AI
 * 채팅. useChat로 /api/agent에 스트리밍 요청하고, 응답 종료 시 토큰 사용량을
 * 받아 한도를 차감한다(onTurnComplete). 한도 소진 시 입력이 비활성화된다.
 * 접힘(isOpen=false) 상태에서도 마운트를 유지해 대화 기록이 보존된다.
 *
 * 코드 안정 반영(SEARCH/REPLACE): '직접 편집'이 켜져 있으면 답변이 끝났을 때 답변에서
 * "찾을 코드 → 바꿀 코드" 블록을 파싱(parseSearchReplaceEdits)해 부모(onApplyAiEdits)에
 * 넘긴다. 부모가 현재 파일에서 SEARCH가 **정확히 1곳** 일치할 때만 교체하므로(미일치·복수
 * 일치는 거부) 부분 조각이 파일을 훼손하지 않고, 파일 전체가 아니라 바뀐 부분만 오가
 * 토큰도 아낀다. 전송 시 autoApplyEdits 플래그로 서버가 이 출력 형식 계약을 AI에 덧붙인다.
 * 적용 직전 onAiCodeStreamStart(스냅샷), 직후 onAiCodeStreamEnd를 호출하고, 반영 결과
 * (몇 곳 반영/미반영)를 하단에 짧게 표시한다.
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

import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { AiPolicy, AgentUsageMetadata } from '@/shared/core/types';
import type { SubmissionPromptTurn } from '@/shared/core/stores/submissionStore';
import {
  parseSearchReplaceEdits,
  type FileEdit,
} from '@/shared/lib/utils/markdownCode';
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

/** 코드 편집 반영 결과 — 몇 곳이 반영/미반영되었는지. */
export interface EditApplyReport {
  /** SEARCH가 정확히 일치해 교체된 편집 수 */
  applied: number;
  /** 미일치·복수 일치 등으로 거부된 편집 수 */
  failed: number;
}

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
  /** 이번 답변의 코드 반영을 시작할 때 1회 (부모가 현재 코드 스냅샷 — 되돌리기용) */
  onAiCodeStreamStart: () => void;
  /**
   * 파싱된 SEARCH/REPLACE 편집들을 현재 파일에 적용한다. 부모가 SEARCH 정확 일치 시에만
   * 교체하고(미일치·복수 일치는 거부), 반영/미반영 건수를 리포트로 돌려준다.
   */
  onApplyAiEdits: (edits: FileEdit[]) => EditApplyReport;
  /** 코드 반영 종료 (부모가 '작성 중' 해제) */
  onAiCodeStreamEnd: () => void;
  /**
   * 현재 코드 상태를 마크다운 문자열로 반환한다(전송 시점에 호출). 주어지면 '코드 첨부'
   * 토글이 노출되어, 켜져 있을 때 질문 뒤에 이 문자열을 덧붙여 보낸다. 없으면 토글 미노출.
   */
  getCodeContext?: () => string;
  /**
   * 대화가 바뀔 때마다 정리된 트랜스크립트(역할+텍스트, 코드첨부분 제외)를 부모에 전달한다.
   * 제출 시 프롬프트 기록을 캡처하는 용도(선택 — 없으면 미동작). 스트리밍 중 자주 호출되므로
   * 부모는 ref에 보관해 재렌더를 피하는 것이 좋다.
   */
  onMessagesChange?: (transcript: SubmissionPromptTurn[]) => void;
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

/** 반영 리포트를 사람이 읽는 한 줄로(둘 다 0이면 null → 표시 안 함). */
function formatApplyStatus(report: EditApplyReport): string | null {
  const { applied, failed } = report;
  if (applied === 0 && failed === 0) return null;
  const parts: string[] = [];
  if (applied > 0) parts.push(`✓ ${applied}곳 반영`);
  if (failed > 0) parts.push(`⚠ ${failed}곳 미반영 (코드가 일치하지 않음)`);
  return parts.join(' · ');
}

/** 메시지 parts에서 텍스트만 이어 붙인다. */
function messageText(message: { parts: { type: string; text?: string }[] }): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('');
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
  onApplyAiEdits,
  onAiCodeStreamEnd,
  getCodeContext,
  onMessagesChange,
}: AiChatPanelProps) {
  const policy = aiPolicy;
  const remainingQuestions = Math.max(policy.maxQuestions - questionsUsed, 0);
  const remainingTokens = Math.max(policy.maxTokens - tokensUsed, 0);
  // 코드 첨부는 부모가 getCodeContext를 줄 때만 노출한다. 기본 ON(맥락 제공이 목적).
  const canAttachCode = typeof getCodeContext === 'function';
  const [isAttachCodeEnabled, setIsAttachCodeEnabled] = useState(true);
  // 마지막 답변의 코드 반영 결과 한 줄(✓ 2곳 반영 · ⚠ 1곳 미반영). 없으면 미표시.
  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/agent' }),
    [],
  );

  // ── 코드 반영(SEARCH/REPLACE, 답변 완료 시 1회) ──────────────────────────
  // 답변이 끝나면 본문에서 SEARCH/REPLACE 편집을 파싱해 부모(onApplyAiEdits)가 현재
  // 파일에 적용한다. 스트리밍 도중이 아니라 완료 시 한 번만 적용하므로 중간 상태가
  // 에디터에 새지 않고, 부모가 SEARCH 정확 일치 시에만 교체해 파일 훼손을 막는다.
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      const usage = message.metadata as AgentUsageMetadata | undefined;
      onTurnComplete(usage?.totalTokens ?? 0);
      if (!isDirectEditEnabled) return;
      const edits = parseSearchReplaceEdits(messageText(message));
      if (edits.length === 0) {
        setApplyStatus(null);
        return;
      }
      onAiCodeStreamStart(); // 반영 직전 현재 코드 스냅샷(되돌리기용)
      const report = onApplyAiEdits(edits);
      onAiCodeStreamEnd();
      setApplyStatus(formatApplyStatus(report));
    },
  });

  const [input, setInput] = useState('');
  const isBusy = status === 'submitted' || status === 'streaming';
  const isQuotaExhausted = remainingQuestions <= 0 || remainingTokens <= 0;
  const canSend = input.trim().length > 0 && !isBusy && !isQuotaExhausted;

  // 대화 트랜스크립트를 부모에 전달(제출 기록 캡처용). user 메시지는 코드 첨부분을 제외한
  // 질문만 담는다(코드는 submittedFiles로 따로 저장). 스트리밍 중에도 갱신된다.
  useEffect(() => {
    if (!onMessagesChange) return;
    const transcript: SubmissionPromptTurn[] = [];
    for (const message of messages) {
      if (message.role !== 'user' && message.role !== 'assistant') continue;
      const text = message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');
      const cleaned = message.role === 'user' ? splitQuestionAndContext(text)[0] : text;
      transcript.push({ role: message.role, text: cleaned });
    }
    onMessagesChange(transcript);
  }, [messages, onMessagesChange]);

  const handleSend = () => {
    if (!canSend) return;
    const question = input;
    setInput('');
    setApplyStatus(null); // 이전 반영 상태는 지운다(새 답변에서 다시 채워짐)
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
          // 직접 편집(자동 반영)이 켜져 있으면 서버가 SEARCH/REPLACE 출력 계약을 시스템에
          // 덧붙여, AI가 파일 전체가 아니라 바뀐 부분만 그 형식으로 내도록 유도한다.
          autoApplyEdits: isDirectEditEnabled,
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
          AI 코드 자동 반영 (바뀐 부분만 에디터에 적용)
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
        {isDirectEditEnabled && applyStatus && (
          <ApplyStatus>{applyStatus}</ApplyStatus>
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

// 마지막 답변의 코드 반영 결과 한 줄(✓ 반영 / ⚠ 미반영).
const ApplyStatus = styled.div`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.text};
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
    $role === 'user' ? '#ffffff' : theme.colors.text};
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
