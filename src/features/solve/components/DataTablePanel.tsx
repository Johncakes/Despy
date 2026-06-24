/**
 * DataTablePanel.tsx — 백엔드 데이터 상태 테이블 뷰
 *
 * 컬렉션 조회 결과(useWorkspace.apiData)를 테이블로 보여준다. API 콘솔(Swagger)에서 요청을
 * 보내면 데이터가 갱신되므로, 이 패널을 보면 "API 호출 → 데이터 변화"를 표로 추적할 수 있다.
 * 백엔드 단독 미션에서 쓸모없는 미리보기 iframe(raw JSON) 대신 이 탭을 노출한다.
 *
 * 응답 바디를 best-effort로 표 모델로 변환한다(객체 배열→행/열, 객체→키·값, 그 외→원문).
 * 새로고침은 컬렉션을 다시 GET하고, 초기화는 dev 서버를 재시작해 데이터를 초기 상태로 되돌린다.
 * 실제 fetch·재시작은 콜백으로 위임한다(레이어 규칙 — feature 컴포넌트는 런타임을 직접 만지지 않는다).
 *
 * 사용처: features/solve/components/WorkspacePanel ('데이터' 탭)
 */
'use client';

import { useState } from 'react';
import styled from 'styled-components';
import type { ApiConsoleResponse } from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

interface DataTablePanelProps {
  /** 데이터를 읽어오는 컬렉션 경로(헤더 표시용, 예: '/todos'). */
  dataPath: string;
  /** 컬렉션 조회 결과(미로드면 null). */
  data: ApiConsoleResponse | null;
  /** 데이터를 다시 불러오는 중인지. */
  isLoading: boolean;
  /** 워크스페이스가 준비(ready)됐는지 — 준비 전에는 버튼 비활성. */
  isReady: boolean;
  /** 수동 새로고침 콜백(컬렉션 재조회). */
  onRefresh: () => void;
  /** 데이터 초기화 콜백(dev 서버 재시작). 없으면 초기화 버튼을 숨긴다. */
  onReset?: () => Promise<void>;
}

/** 응답 바디를 표로 그릴 때 쓰는 중간 모델. */
type TableModel =
  | { kind: 'rows'; columns: string[]; rows: Record<string, unknown>[] }
  | { kind: 'keyValue'; entries: [string, unknown][] }
  | { kind: 'raw'; text: string };

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 일반 객체(배열·null 아님)인지. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 객체 배열에서 등장 순서대로 열(키) 합집합을 만든다. */
function collectColumns(rows: Record<string, unknown>[]): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns;
}

/** 셀 값 → 표시 문자열(객체·배열은 JSON, null/undefined는 표식). */
function formatCell(value: unknown): string {
  if (value === null) return '∅';
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * 응답 바디를 표 모델로 변환한다(best-effort). 객체 배열은 행/열 표로, 단일 객체는 키·값
 * 표로, 그 외(원시값·파싱 실패)는 원문으로 보여준다. 객체가 배열 프로퍼티 하나만 감싸고
 * 있으면(예: { todos: [...] }) 그 배열을 표로 펼친다.
 */
function deriveTable(body: string | undefined): TableModel {
  if (!body || body.trim().length === 0) return { kind: 'raw', text: '(빈 응답)' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { kind: 'raw', text: body };
  }

  // { key: [...] } 형태면 감싼 배열을 펼친다.
  if (isPlainObject(parsed)) {
    const arrayEntries = Object.entries(parsed).filter(([, value]) => Array.isArray(value));
    if (arrayEntries.length === 1) {
      parsed = arrayEntries[0][1];
    } else {
      return { kind: 'keyValue', entries: Object.entries(parsed) };
    }
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { kind: 'rows', columns: [], rows: [] };
    const allObjects = parsed.every(isPlainObject);
    if (allObjects) {
      const rows = parsed as Record<string, unknown>[];
      return { kind: 'rows', columns: collectColumns(rows), rows };
    }
    // 원시값 배열 → '값' 단일 열.
    const rows = parsed.map((item) => ({ 값: item }));
    return { kind: 'rows', columns: ['값'], rows };
  }

  return { kind: 'raw', text: formatCell(parsed) };
}

/** 표 모델의 행 개수(헤더 카운트용, 행 표가 아니면 null). */
function rowCountOf(model: TableModel): number | null {
  return model.kind === 'rows' ? model.rows.length : null;
}

// ── Component ─────────────────────────────────────────────────────────────

export function DataTablePanel({
  dataPath,
  data,
  isLoading,
  isReady,
  onRefresh,
  onReset,
}: DataTablePanelProps) {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!onReset || isResetting) return;
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
    }
  };

  const model = data && !data.error ? deriveTable(data.body) : null;
  const rowCount = model ? rowCountOf(model) : null;

  return (
    <Wrapper>
      <Header>
        <HeaderInfo>
          <Title>데이터</Title>
          <PathHint>GET {dataPath}</PathHint>
          {rowCount !== null && <CountBadge>{rowCount}건</CountBadge>}
        </HeaderInfo>
        <Actions>
          <ActionButton type="button" onClick={onRefresh} disabled={!isReady || isLoading}>
            {isLoading ? '불러오는 중…' : '새로고침'}
          </ActionButton>
          {onReset && (
            <ActionButton
              type="button"
              $tone="danger"
              onClick={() => void handleReset()}
              disabled={!isReady || isResetting}
            >
              {isResetting ? '초기화 중…' : '데이터 초기화'}
            </ActionButton>
          )}
        </Actions>
      </Header>

      <Body>
        {!isReady ? (
          <Placeholder>워크스페이스가 준비되면 현재 데이터가 표시됩니다.</Placeholder>
        ) : data === null ? (
          <Placeholder>데이터를 불러오는 중입니다…</Placeholder>
        ) : data.error ? (
          <ErrorText>{data.error}</ErrorText>
        ) : (
          model && <TableView model={model} />
        )}
      </Body>
    </Wrapper>
  );
}

/** 표 모델 종류에 따라 행/열 표·키값 표·원문을 그린다. */
function TableView({ model }: { model: TableModel }) {
  if (model.kind === 'raw') {
    return <RawText>{model.text}</RawText>;
  }

  if (model.kind === 'keyValue') {
    return (
      <Table>
        <tbody>
          {model.entries.map(([key, value]) => (
            <tr key={key}>
              <Th as="td">{key}</Th>
              <Td>{formatCell(value)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }

  if (model.rows.length === 0) {
    return <Placeholder>데이터가 비어 있습니다.</Placeholder>;
  }

  return (
    <Table>
      <thead>
        <tr>
          {model.columns.map((column) => (
            <Th key={column}>{column}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {model.columns.map((column) => (
              <Td key={column}>{formatCell(row[column])}</Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const HeaderInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const PathHint = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CountBadge = styled.span`
  padding: 1px ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.info};
  background: ${({ theme }) => `${theme.colors.info}22`};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ActionButton = styled.button<{ $tone?: 'danger' }>`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $tone }) =>
    $tone === 'danger' ? theme.colors.danger : theme.colors.text};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid
    ${({ theme, $tone }) => ($tone === 'danger' ? theme.colors.danger : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.md};
`;

const Placeholder = styled.div`
  padding: ${({ theme }) => theme.spacing.lg} 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
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

const RawText = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.text};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  white-space: pre-wrap;
  word-break: break-word;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.font.sizeSm};
`;

const Th = styled.th`
  position: sticky;
  top: 0;
  text-align: left;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.font.mono};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  vertical-align: top;
  word-break: break-word;
`;
