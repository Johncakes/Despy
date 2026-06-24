/**
 * ApiLogList.tsx — 백엔드 요청/응답 실시간 로그 (API 로그 탭)
 *
 * 백엔드가 처리한 요청을 시간순으로 보여준다(상태코드·메서드·경로·소요시간 + 펼치면
 * 요청/응답 바디). 잠긴 서버의 로깅 미들웨어가 stdout으로 흘린 항목을 useWorkspace가
 * 파싱해 만든 ApiLogEntry[]를 표시 전용으로 렌더한다(상태 비보유 — props/콜백만).
 *
 * 콘솔 수동 요청뿐 아니라 프론트(풀스택)가 보낸 요청까지 모두 잡힌다 — 동료 피드백의
 * "API 입출력 값을 실시간으로" 충족.
 *
 * 사용처: features/solve/components/WorkspacePanel ('API 로그' 탭)
 */
'use client';

import { useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import type { ApiLogEntry } from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';

// ── Types ─────────────────────────────────────────────────────────────────

interface ApiLogListProps {
  entries: ApiLogEntry[];
  onClear: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 상태코드 → 톤(2xx 성공·4xx/5xx 위험·그 외 중립). */
function statusTone(status: number): 'success' | 'danger' | 'neutral' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400) return 'danger';
  return 'neutral';
}

/** 값을 보기 좋은 JSON 문자열로(객체/배열만 정렬, 원시값은 그대로). */
function formatValue(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function ApiLogList({ entries, onClear }: ApiLogListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // 새 로그가 들어오면 맨 아래로 스크롤한다(최신 요청을 따라간다).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries]);

  return (
    <Wrapper>
      <Toolbar>
        <Button variant="ghost" onClick={onClear} disabled={entries.length === 0}>
          지우기
        </Button>
        <Hint>백엔드가 처리한 요청/응답이 실시간으로 쌓입니다(콘솔·프론트 요청 모두).</Hint>
      </Toolbar>

      <LogBody>
        {entries.length === 0 ? (
          <Empty>아직 요청이 없습니다. API 콘솔이나 미리보기에서 요청을 보내보세요.</Empty>
        ) : (
          entries.map((entry) => {
            const hasBody = entry.reqBody !== undefined || entry.resBody !== undefined;
            return (
              <Row key={entry.id}>
                <RowHeader>
                  <StatusPill $tone={statusTone(entry.status)}>{entry.status}</StatusPill>
                  <Method>{entry.method}</Method>
                  <Path>{entry.path}</Path>
                  <Duration>{entry.durationMs}ms</Duration>
                </RowHeader>
                {hasBody && (
                  <Bodies>
                    {entry.reqBody !== undefined && (
                      <BodyBlock>
                        <BodyLabel>요청</BodyLabel>
                        <BodyPre>{formatValue(entry.reqBody)}</BodyPre>
                      </BodyBlock>
                    )}
                    {entry.resBody !== undefined && (
                      <BodyBlock>
                        <BodyLabel>응답</BodyLabel>
                        <BodyPre>{formatValue(entry.resBody)}</BodyPre>
                      </BodyBlock>
                    )}
                  </Bodies>
                )}
              </Row>
            );
          })
        )}
        <div ref={endRef} />
      </LogBody>
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Hint = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const LogBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Empty = styled.div`
  margin: auto;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const Row = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
`;

const RowHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
`;

const StatusPill = styled.span<{ $tone: 'success' | 'danger' | 'neutral' }>`
  flex-shrink: 0;
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

const Method = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const Path = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
`;

const Duration = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Bodies = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 0 ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.sm};
`;

const BodyBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const BodyLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const BodyPre = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm};
  max-height: 160px;
  overflow: auto;
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.text};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;
