/**
 * FileTree.tsx — 워크스페이스 파일 목록 (선택 + 잠금 표시)
 *
 * 편집 버퍼의 파일 경로들을 정렬해 보여주고, 클릭하면 해당 파일을 에디터에서
 * 연다(잠금 파일도 열어 read-only로 볼 수 있다). 잠금 경로는 자물쇠 배지로
 * 표시한다. 상태를 갖지 않는 표시 전용 컴포넌트(props/콜백 통신).
 *
 * MVP 단순화: 중첩 트리 UI 대신 경로 평면 목록으로 시작한다(spec §5, 후속 단계에서
 * 본격 트리 편집 UI로 확장).
 *
 * 사용처: features/solve/components/WorkspaceEditorPanel
 */
'use client';

import styled, { css } from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

interface FileTreeProps {
  /** 표시할 파일 경로 목록 */
  paths: string[];
  activePath: string;
  lockedPaths: readonly string[];
  onSelectFile: (path: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FileTree({ paths, activePath, lockedPaths, onSelectFile }: FileTreeProps) {
  const lockedSet = new Set(lockedPaths);
  const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b));

  return (
    <List>
      {sortedPaths.map((path) => {
        const isLocked = lockedSet.has(path);
        return (
          <Row
            key={path}
            type="button"
            $active={path === activePath}
            onClick={() => onSelectFile(path)}
            title={isLocked ? `${path} (잠금 · 편집 불가)` : path}
          >
            <PathText>{path}</PathText>
            {isLocked && <Lock aria-label="잠금">🔒</Lock>}
          </Row>
        );
      })}
    </List>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const List = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.xs};
  gap: 2px;
  overflow: auto;
  height: 100%;
`;

const Row = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: ${({ theme }) => theme.font.mono};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }

  ${({ theme, $active }) =>
    $active &&
    css`
      color: ${theme.colors.text};
      background: ${theme.colors.surfaceAlt};
      border-color: ${theme.colors.border};
    `}
`;

const PathText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Lock = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
`;
