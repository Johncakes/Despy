/**
 * DbInspector.tsx — 백엔드 저장소(db.json) 상태 실시간 뷰 (DB 상태 탭)
 *
 * useWorkspace가 fs.watch로 갱신하는 db.json 파싱 결과(dbState)를 보기 좋게 렌더한다.
 * 최상위 객체의 "객체 배열" 값(예: todos)은 표로, 그 외 스칼라(예: nextId)는 키-값으로
 * 보여준다. 백엔드가 저장소에 쓸 때마다 파일이 바뀌고 → watch가 갱신 → 이 뷰가 실시간으로
 * 바뀐다(동료 피드백의 "DB 상태를 실시간으로" 충족). 표시 전용(상태 비보유).
 *
 * 사용처: features/solve/components/WorkspacePanel ('DB 상태' 탭)
 */
'use client';

import styled from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

interface DbInspectorProps {
  /** 파싱된 db.json 내용(없거나 아직 안 읽혔으면 null). */
  data: unknown;
  /** 워크스페이스 준비 여부 — 준비 전에는 안내만 표시. */
  isReady: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArrayOfObjects(value: unknown): value is PlainObject[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

/** 테이블 셀/스칼라 값을 표시 문자열로(객체/배열은 JSON, 그 외는 String). */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** 객체 배열에서 컬럼 목록(키 합집합, 등장 순서 유지)을 뽑는다. */
function collectColumns(rows: PlainObject[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

// ── Component ─────────────────────────────────────────────────────────────

export function DbInspector({ data, isReady }: DbInspectorProps) {
  if (!isReady) {
    return (
      <Wrapper>
        <Empty>워크스페이스가 준비되면 저장소 상태가 표시됩니다.</Empty>
      </Wrapper>
    );
  }
  if (data === null || data === undefined) {
    return (
      <Wrapper>
        <Empty>아직 저장소가 비어 있거나 읽지 못했습니다.</Empty>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <Hint>저장소 파일(db.json)이 바뀔 때마다 실시간으로 갱신됩니다.</Hint>
      {isPlainObject(data) ? (
        <Sections>
          {Object.entries(data).map(([key, value]) =>
            isArrayOfObjects(value) ? (
              <CollectionTable key={key} name={key} rows={value} />
            ) : (
              <ScalarRow key={key}>
                <ScalarKey>{key}</ScalarKey>
                <ScalarValue>{formatCell(value)}</ScalarValue>
              </ScalarRow>
            ),
          )}
        </Sections>
      ) : isArrayOfObjects(data) ? (
        <Sections>
          <CollectionTable name="(목록)" rows={data} />
        </Sections>
      ) : (
        <RawPre>{formatCell(data)}</RawPre>
      )}
    </Wrapper>
  );
}

/** 객체 배열을 표로 렌더한다(컬럼 = 키 합집합). */
function CollectionTable({ name, rows }: { name: string; rows: PlainObject[] }) {
  const columns = collectColumns(rows);
  return (
    <Section>
      <Caption>
        {name} <Count>{rows.length}</Count>
      </Caption>
      <TableScroll>
        <Table>
          <thead>
            <tr>
              {columns.map((column) => (
                <Th key={column}>{column}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <Td key={column}>{formatCell(row[column])}</Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
    </Section>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  height: 100%;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.md};
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

const Hint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Sections = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Caption = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.font.mono};
`;

const Count = styled.span`
  padding: ${({ theme }) => `1px ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeXs};
`;

const TableScroll = styled.div`
  overflow: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
`;

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: ${({ theme }) => theme.font.weightBold};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  color: ${({ theme }) => theme.colors.text};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  vertical-align: top;
  word-break: break-word;
`;

const ScalarRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
`;

const ScalarKey = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ScalarValue = styled.span`
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;
`;

const RawPre = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm};
  overflow: auto;
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.text};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  white-space: pre-wrap;
  word-break: break-word;
`;
