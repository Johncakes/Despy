/**
 * ApiConsole.tsx — 백엔드 API 라이브 요청 콘솔 (Postman 라이트)
 *
 * 메서드·경로·바디를 입력해 워크스페이스의 백엔드로 요청을 보내고, 상태코드·소요시간·
 * 응답 바디(JSON이면 보기 좋게 정렬)·헤더를 보여준다. 백엔드 단독 미션은 미리보기 iframe이
 * raw JSON만 보여 상호작용이 안 되므로, 이 콘솔이 "실시간으로 API를 굴려보는" 핵심 UX다.
 *
 * 실제 요청 실행은 useWorkspace.sendApiRequest(→ runtime.sendHttpRequest)가 컨테이너 *안에서*
 * 수행한다(호스트 직접 fetch는 CORS/COEP에 막힘). 이 컴포넌트는 입력/표시만 담당하고, 전송은
 * onSend 콜백으로 위임한다(레이어 규칙 — feature 컴포넌트는 런타임을 직접 만지지 않는다).
 *
 * 사용처: features/solve/components/WorkspacePanel ('API 콘솔' 탭)
 */
'use client';

import { useState } from 'react';
import styled, { css } from 'styled-components';
import type {
  ApiConsoleConfig,
  ApiConsoleRequest,
  ApiConsoleResponse,
} from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';

// ── Constants ─────────────────────────────────────────────────────────────

/** 콘솔에서 고를 수 있는 HTTP 메서드. */
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = (typeof METHODS)[number];

/** 바디 입력을 보여줄 메서드(요청 바디가 의미 있는 것만). */
const METHODS_WITH_BODY = new Set<Method>(['POST', 'PUT', 'PATCH']);

// ── Types ─────────────────────────────────────────────────────────────────

interface ApiConsoleProps {
  config: ApiConsoleConfig;
  /** 워크스페이스가 준비(ready)됐는지 — 준비 전에는 전송 비활성. */
  isReady: boolean;
  /** 요청 전송 콜백 — 컨테이너 안에서 실행해 결과를 반환한다. */
  onSend: (request: ApiConsoleRequest) => Promise<ApiConsoleResponse>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 상태코드 → 톤(2xx 성공·4xx/5xx 위험·그 외 중립). */
function statusTone(status?: number): 'success' | 'danger' | 'neutral' {
  if (status === undefined) return 'neutral';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400) return 'danger';
  return 'neutral';
}

/** 응답 바디가 JSON이면 보기 좋게 정렬, 아니면 원문 그대로 반환. */
function formatBody(body?: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function ApiConsole({ config, isReady, onSend }: ApiConsoleProps) {
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState(config.defaultPath);
  const [body, setBody] = useState('{\n  "title": "책 읽기"\n}');
  const [response, setResponse] = useState<ApiConsoleResponse | null>(null);
  const [isSending, setIsSending] = useState(false);

  const showBody = METHODS_WITH_BODY.has(method);
  const canSend = isReady && !isSending && path.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setIsSending(true);
    try {
      const result = await onSend({
        method,
        path: path.trim(),
        body: showBody ? body : undefined,
      });
      setResponse(result);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Wrapper onSubmit={handleSubmit}>
      <RequestBar>
        <MethodSelect
          value={method}
          onChange={(event) => setMethod(event.target.value as Method)}
          aria-label="HTTP 메서드"
        >
          {METHODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </MethodSelect>
        <PathInput
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/api/todos"
          aria-label="요청 경로"
          spellCheck={false}
        />
        <Button type="submit" disabled={!canSend}>
          {isSending ? '전송 중…' : 'Send'}
        </Button>
      </RequestBar>

      <BaseHint>
        요청 대상: <code>http://localhost:{config.port}</code> (컨테이너 내부 백엔드)
        {!isReady && ' · 워크스페이스가 준비되면 전송할 수 있습니다.'}
      </BaseHint>

      {showBody && (
        <BodyField>
          <FieldLabel>요청 바디 (JSON)</FieldLabel>
          <BodyTextArea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            spellCheck={false}
            rows={5}
          />
        </BodyField>
      )}

      <ResponseArea>
        {response === null ? (
          <ResponseEmpty>
            요청을 보내면 여기에 상태코드와 응답이 표시됩니다.
          </ResponseEmpty>
        ) : response.error ? (
          <ResponseError>
            <ResponseMetaRow>
              <StatusPill $tone="danger">실패</StatusPill>
              <MetaText>{response.durationMs}ms</MetaText>
            </ResponseMetaRow>
            <ErrorText>{response.error}</ErrorText>
          </ResponseError>
        ) : (
          <>
            <ResponseMetaRow>
              <StatusPill $tone={statusTone(response.status)}>
                {response.status} {response.statusText}
              </StatusPill>
              <MetaText>{response.durationMs}ms</MetaText>
            </ResponseMetaRow>
            <ResponseBody>{formatBody(response.body) || '(빈 응답)'}</ResponseBody>
          </>
        )}
      </ResponseArea>
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.form`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: ${({ theme }) => theme.spacing.md};
  gap: ${({ theme }) => theme.spacing.sm};
`;

const RequestBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const MethodSelect = styled.select`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
`;

const PathInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const BaseHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};

  code {
    font-family: ${({ theme }) => theme.font.mono};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const BodyField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const BodyTextArea = styled.textarea`
  width: 100%;
  resize: vertical;
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.codeBg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  line-height: 1.5;
`;

const ResponseArea = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  overflow: auto;
`;

const ResponseEmpty = styled.div`
  margin: auto;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const ResponseError = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ResponseMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StatusPill = styled.span<{ $tone: 'success' | 'danger' | 'neutral' }>`
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  font-family: ${({ theme }) => theme.font.mono};

  ${({ theme, $tone }) => {
    const color =
      $tone === 'success'
        ? theme.colors.success
        : $tone === 'danger'
          ? theme.colors.danger
          : theme.colors.textMuted;
    return css`
      color: ${color};
      background: ${color}22;
    `;
  }}
`;

const MetaText = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ErrorText = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.danger};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  white-space: pre-wrap;
  word-break: break-word;
`;

const ResponseBody = styled.pre`
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm};
  overflow: auto;
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.text};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;
