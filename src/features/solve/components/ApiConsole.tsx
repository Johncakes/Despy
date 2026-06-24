/**
 * ApiConsole.tsx — 백엔드 API 라이브 콘솔 (Swagger 라이트)
 *
 * 두 가지를 제공한다.
 *  1) 엔드포인트 목록(Swagger식) — 백엔드 소스에서 추론한 라우트를 클릭하면 요청 바에 채워진다.
 *  2) 요청 콘솔 — 메서드·경로·바디를 입력해 워크스페이스 백엔드로 요청을 보내고 응답을 본다.
 *
 * 호출 결과로 데이터가 어떻게 바뀌는지는 별도 '데이터' 탭(DataTablePanel)이 테이블로 보여준다.
 * 변경 요청(POST/PUT/…)이 성공하면 useWorkspace.sendApiRequest가 그 테이블을 자동 갱신한다.
 *
 * 실제 요청 실행은 useWorkspace.sendApiRequest(→ runtime.sendHttpRequest)가 컨테이너 *안에서*
 * 수행한다(호스트 직접 fetch는 CORS/COEP에 막힘). 이 컴포넌트는 입력/표시만 맡고, 전송은
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
  ApiEndpoint,
} from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';

// ── Constants ─────────────────────────────────────────────────────────────

/** 콘솔에서 고를 수 있는 HTTP 메서드. */
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = (typeof METHODS)[number];

/** 바디 입력을 보여줄 메서드(요청 바디가 의미 있는 것만). */
const METHODS_WITH_BODY = new Set<Method>(['POST', 'PUT', 'PATCH']);

/** 바디 메서드를 처음 고를 때 채워주는 예시 바디. */
const SAMPLE_BODY = '{\n  "title": "책 읽기"\n}';

/** 메서드 → 배지 색 톤. */
const METHOD_TONE: Record<Method, 'get' | 'post' | 'put' | 'delete'> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'put',
  DELETE: 'delete',
};

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

/** 메서드 문자열이 콘솔이 지원하는 Method인지 좁힌다. */
function asMethod(value: string): Method {
  return (METHODS as readonly string[]).includes(value) ? (value as Method) : 'GET';
}

// ── Component ─────────────────────────────────────────────────────────────

export function ApiConsole({ config, isReady, onSend }: ApiConsoleProps) {
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState(config.defaultPath);
  const [body, setBody] = useState(SAMPLE_BODY);
  const [response, setResponse] = useState<ApiConsoleResponse | null>(null);
  const [isSending, setIsSending] = useState(false);

  const showBody = METHODS_WITH_BODY.has(method);
  const canSend = isReady && !isSending && path.trim().length > 0;

  // 엔드포인트 목록에서 한 줄 클릭 → 요청 바에 메서드·경로 채우기(바디 메서드면 예시 바디 보강).
  const handleEndpointPick = (endpoint: ApiEndpoint) => {
    const picked = asMethod(endpoint.method);
    setMethod(picked);
    setPath(endpoint.path);
    if (METHODS_WITH_BODY.has(picked) && body.trim().length === 0) {
      setBody(SAMPLE_BODY);
    }
  };

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
      {config.endpoints.length > 0 && (
        <EndpointList>
          <SectionLabel>엔드포인트</SectionLabel>
          {config.endpoints.map((endpoint) => (
            <EndpointRow
              key={`${endpoint.method} ${endpoint.path}`}
              type="button"
              onClick={() => handleEndpointPick(endpoint)}
            >
              <MethodTag $tone={METHOD_TONE[asMethod(endpoint.method)]}>
                {endpoint.method}
              </MethodTag>
              <EndpointPath>{endpoint.path}</EndpointPath>
            </EndpointRow>
          ))}
        </EndpointList>
      )}

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
        {!isReady
          ? ' · 워크스페이스가 준비되면 전송할 수 있습니다.'
          : ' · 변경 요청 후 ‘데이터’ 탭에서 결과를 확인하세요.'}
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
        <SectionLabel>응답</SectionLabel>
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
  overflow-y: auto;
`;

const SectionLabel = styled.div`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const EndpointList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const EndpointRow = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const MethodTag = styled.span<{ $tone: 'get' | 'post' | 'put' | 'delete' }>`
  flex-shrink: 0;
  min-width: 52px;
  text-align: center;
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  font-family: ${({ theme }) => theme.font.mono};

  ${({ theme, $tone }) => {
    const color =
      $tone === 'get'
        ? theme.colors.success
        : $tone === 'post'
          ? theme.colors.primary
          : $tone === 'put'
            ? theme.colors.warning
            : theme.colors.danger;
    return css`
      color: ${color};
      background: ${color}22;
    `;
  }}
`;

const EndpointPath = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
  word-break: break-all;
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
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ResponseEmpty = styled.div`
  padding: ${({ theme }) => theme.spacing.md} 0;
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
  margin: 0;
  max-height: 280px;
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
