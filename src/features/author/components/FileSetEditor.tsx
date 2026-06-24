/**
 * FileSetEditor.tsx — 파일 세트(ProjectFiles) 편집기
 *
 * 경로→내용 평면 맵(ProjectFiles)을 파일 단위로 편집한다(§13 결정4 — 프리셋 +
 * 파일 단위 편집/추가/잠금 토글). 각 파일은 경로 헤더 + 내용 textarea로 표시하고,
 * 하단 입력으로 새 파일을 추가한다. 경로 변경(rename)은 MVP 범위 밖이라 삭제 후
 * 재추가로 처리한다(드래그앤드롭 풀 트리 편집은 후속 — docs/spec-webcontainer.md §5).
 *
 * lockedPaths/onLockedPathsChange가 주어지면 파일별 잠금(학생 read-only) 토글을
 * 노출한다(시작 템플릿용). testFiles처럼 잠금 개념이 없는 세트에선 생략한다.
 * 상태를 직접 갖지 않고 files/onFilesChange로 부모와 통신한다(제어 컴포넌트).
 *
 * 사용처: features/author/components/ChallengeForm
 */
'use client';

import { useState } from 'react';
import styled from 'styled-components';
import type { ProjectFiles } from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';
import { TextInput, TextArea } from '@/shared/components/ui/Field';

// ── Types ─────────────────────────────────────────────────────────────────

interface FileSetEditorProps {
  files: ProjectFiles;
  onFilesChange: (next: ProjectFiles) => void;
  /** 잠금 토글을 노출하려면 lockedPaths/onLockedPathsChange를 함께 제공한다. */
  lockedPaths?: readonly string[];
  onLockedPathsChange?: (next: string[]) => void;
  /** 파일이 하나도 없을 때 표시할 안내 문구 */
  emptyHint?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FileSetEditor({
  files,
  onFilesChange,
  lockedPaths,
  onLockedPathsChange,
  emptyHint,
}: FileSetEditorProps) {
  const [newPath, setNewPath] = useState('');

  const paths = Object.keys(files).sort();
  const showLock = lockedPaths !== undefined && onLockedPathsChange !== undefined;
  const lockedSet = new Set(lockedPaths ?? []);

  const handleAddFile = () => {
    const path = newPath.trim();
    if (!path || path in files) return;
    onFilesChange({ ...files, [path]: '' });
    setNewPath('');
  };

  const handleRemoveFile = (path: string) => {
    const next = { ...files };
    delete next[path];
    onFilesChange(next);
    if (showLock && lockedSet.has(path)) {
      onLockedPathsChange?.((lockedPaths ?? []).filter((item) => item !== path));
    }
  };

  const handleContentChange = (path: string, content: string) => {
    onFilesChange({ ...files, [path]: content });
  };

  const handleToggleLock = (path: string, locked: boolean) => {
    if (!showLock) return;
    const base = (lockedPaths ?? []).filter((item) => item !== path);
    onLockedPathsChange?.(locked ? [...base, path] : base);
  };

  return (
    <Wrapper>
      {paths.map((path) => {
        const isLocked = showLock && lockedSet.has(path);
        return (
          <FileRow key={path}>
            <FileHeader>
              <FilePath $locked={isLocked}>
                {isLocked && <LockMark aria-hidden>🔒</LockMark>}
                {path}
              </FilePath>
              <FileActions>
                {showLock && (
                  <LockToggle>
                    <input
                      type="checkbox"
                      checked={lockedSet.has(path)}
                      onChange={(event) => handleToggleLock(path, event.target.checked)}
                    />
                    잠금(read-only)
                  </LockToggle>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleRemoveFile(path)}
                >
                  삭제
                </Button>
              </FileActions>
            </FileHeader>
            <TextArea
              value={files[path]}
              onChange={(event) => handleContentChange(path, event.target.value)}
              rows={8}
              spellCheck={false}
            />
          </FileRow>
        );
      })}

      {paths.length === 0 && (
        <Empty>{emptyHint ?? '파일이 없습니다. 아래에서 추가하세요.'}</Empty>
      )}

      <AddRow>
        <TextInput
          value={newPath}
          onChange={(event) => setNewPath(event.target.value)}
          placeholder="예) src/Cart.jsx"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddFile();
            }
          }}
        />
        <Button type="button" variant="ghost" onClick={handleAddFile}>
          + 파일 추가
        </Button>
      </AddRow>
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const FileRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const FileHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const FilePath = styled.span<{ $locked: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme, $locked }) =>
    $locked ? theme.colors.textMuted : theme.colors.text};
`;

const LockMark = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
`;

const FileActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const LockToggle = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  white-space: nowrap;
`;

const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
