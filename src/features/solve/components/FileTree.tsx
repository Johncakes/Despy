/**
 * FileTree.tsx — 워크스페이스 파일 트리 (VSC식 중첩 트리 + 동적 CRUD)
 *
 * 편집 버퍼의 파일 경로들을 폴더 계층으로 묶어 중첩 트리로 보여준다(폴더 펼침/접기,
 * 들여쓰기). 클릭하면 해당 파일을 에디터에서 연다(잠금 파일도 read-only로 열람 가능).
 * 사이드바 상단과 폴더 행의 hover 액션으로 파일/폴더를 동적으로 만들고(인라인 입력),
 * 이름변경·삭제할 수 있다. 잠금 경로는 자물쇠 배지로 표시하고 편집 액션을 숨긴다.
 *
 * 데이터(파일 경로·잠금)는 props로 받고 변경은 콜백으로만 위로 보낸다(DI). 펼침/접기,
 * 인라인 입력, **빈 폴더(아직 파일이 없는 폴더)** 같은 표시 전용 상태만 로컬로 가진다 —
 * 빈 폴더는 경로→내용 평면 맵에 표현되지 않으므로 파일이 생기기 전까지 여기서만 추적한다.
 *
 * 사용처: features/solve/components/WorkspaceEditorPanel
 */
'use client';

import { useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  LockIcon,
  NewFileIcon,
  NewFolderIcon,
  RenameIcon,
  TrashIcon,
} from '@/features/solve/components/FileTreeIcons';

// ── Types ─────────────────────────────────────────────────────────────────

interface FileTreeProps {
  /** 표시할 파일 경로 목록 */
  paths: string[];
  activePath: string;
  lockedPaths: readonly string[];
  onSelectFile: (path: string) => void;
  /** 빈 새 파일 생성 요청(전체 경로) */
  onCreateFile: (path: string) => void;
  /** 파일/폴더(경로 프리픽스) 삭제 요청 */
  onDeletePath: (path: string) => void;
  /** 파일/폴더 경로 변경(이동) 요청 */
  onRenamePath: (fromPath: string, toPath: string) => void;
}

/** 트리 노드 — 폴더(children 보유)와 파일 */
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: TreeNode[];
}

/** 진행 중인 인라인 생성 입력 상태 */
interface PendingCreate {
  parentDir: string;
  kind: 'file' | 'dir';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 디렉토리 경로와 이름을 합쳐 전체 경로를 만든다('' 디렉토리면 이름 그대로). */
function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

/** 경로의 부모 디렉토리(없으면 ''). */
function parentDirOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

/** 경로의 마지막 세그먼트(파일/폴더 이름). */
function baseNameOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

/** 입력 이름 정리 — 앞뒤 공백/슬래시 제거 + 연속 슬래시 축약(중첩 입력 허용). */
function sanitizeName(raw: string): string {
  return raw.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

/**
 * 평면 경로 목록 + 빈 폴더 목록을 중첩 트리로 빌드한다. 폴더 먼저, 그다음 파일순으로
 * 각 레벨을 알파벳 정렬한다.
 */
function buildTree(paths: string[], emptyDirs: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] };

  const ensureDir = (dirPath: string): TreeNode => {
    if (!dirPath) return root;
    let cursor = root;
    let accumulated = '';
    for (const segment of dirPath.split('/').filter(Boolean)) {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      let child = cursor.children.find(
        (node) => node.type === 'dir' && node.name === segment,
      );
      if (!child) {
        child = { name: segment, path: accumulated, type: 'dir', children: [] };
        cursor.children.push(child);
      }
      cursor = child;
    }
    return cursor;
  };

  for (const dir of emptyDirs) ensureDir(dir);

  for (const path of paths) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) continue;
    const fileName = segments[segments.length - 1];
    const parent = ensureDir(segments.slice(0, -1).join('/'));
    parent.children.push({ name: fileName, path, type: 'file', children: [] });
  }

  const sortNode = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return root.children;
}

// ── Component ─────────────────────────────────────────────────────────────

export function FileTree({
  paths,
  activePath,
  lockedPaths,
  onSelectFile,
  onCreateFile,
  onDeletePath,
  onRenamePath,
}: FileTreeProps) {
  const lockedSet = new Set(lockedPaths);

  // 표시 전용 상태: 빈 폴더(파일 없는 폴더), 접힌 폴더, 인라인 생성/이름변경 입력.
  const [emptyDirs, setEmptyDirs] = useState<string[]>([]);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const tree = buildTree(paths, emptyDirs);

  const expandDir = (dirPath: string) => {
    if (!dirPath) return;
    setCollapsedDirs((prev) => {
      if (!prev.has(dirPath)) return prev;
      const next = new Set(prev);
      next.delete(dirPath);
      return next;
    });
  };

  const toggleDir = (dirPath: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  const startCreate = (parentDir: string, kind: 'file' | 'dir') => {
    setRenamingPath(null);
    expandDir(parentDir);
    setPendingCreate({ parentDir, kind });
  };

  const commitCreate = (rawName: string) => {
    if (!pendingCreate) return;
    const name = sanitizeName(rawName);
    const { parentDir, kind } = pendingCreate;
    setPendingCreate(null);
    if (!name) return;
    const fullPath = joinPath(parentDir, name);
    if (kind === 'file') {
      onCreateFile(fullPath);
    } else {
      // 빈 폴더는 평면 맵에 없으므로 로컬로만 추적한다(파일이 생기면 자연히 실폴더가 됨).
      setEmptyDirs((prev) => (prev.includes(fullPath) ? prev : [...prev, fullPath]));
    }
  };

  const commitRename = (rawName: string) => {
    if (!renamingPath) return;
    const fromPath = renamingPath;
    setRenamingPath(null);
    const name = sanitizeName(rawName);
    if (!name) return;
    const toPath = joinPath(parentDirOf(fromPath), name);
    if (toPath === fromPath) return;
    // 파일(또는 파일을 가진 실폴더)은 콜백으로 remap, 빈 폴더 흔적은 로컬에서 remap.
    onRenamePath(fromPath, toPath);
    setEmptyDirs((prev) =>
      prev.map((dir) =>
        dir === fromPath
          ? toPath
          : dir.startsWith(`${fromPath}/`)
            ? `${toPath}${dir.slice(fromPath.length)}`
            : dir,
      ),
    );
  };

  // 행은 <div role="button">라 Enter/Space로도 선택/토글되게 한다(중첩 버튼 방지 + a11y).
  const handleRowKey = (
    event: React.KeyboardEvent<HTMLDivElement>,
    action: () => void,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const handleDelete = (node: TreeNode) => {
    const label = node.type === 'dir' ? '폴더' : '파일';
    if (!window.confirm(`${node.path} ${label}을(를) 삭제할까요?`)) return;
    onDeletePath(node.path);
    setEmptyDirs((prev) =>
      prev.filter((dir) => dir !== node.path && !dir.startsWith(`${node.path}/`)),
    );
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.type === 'dir') {
        const isCollapsed = collapsedDirs.has(node.path);
        return (
          <div key={`dir:${node.path}`}>
            {renamingPath === node.path ? (
              <InlineInput
                depth={depth}
                icon={<FolderIcon size={15} />}
                initialValue={node.name}
                onCommit={commitRename}
                onCancel={() => setRenamingPath(null)}
              />
            ) : (
              <Row
                $active={false}
                $depth={depth}
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                onClick={() => toggleDir(node.path)}
                onKeyDown={(event) => handleRowKey(event, () => toggleDir(node.path))}
                title={node.path}
              >
                <ChevronToggle $expanded={!isCollapsed}>
                  <ChevronRightIcon size={14} />
                </ChevronToggle>
                <NodeIcon>
                  <FolderIcon size={15} />
                </NodeIcon>
                <NameText>{node.name}</NameText>
                <RowActions data-row-actions onClick={(event) => event.stopPropagation()}>
                  <ActionButton
                    type="button"
                    title="새 파일"
                    aria-label="새 파일"
                    onClick={() => startCreate(node.path, 'file')}
                  >
                    <NewFileIcon size={14} />
                  </ActionButton>
                  <ActionButton
                    type="button"
                    title="새 폴더"
                    aria-label="새 폴더"
                    onClick={() => startCreate(node.path, 'dir')}
                  >
                    <NewFolderIcon size={14} />
                  </ActionButton>
                  <ActionButton
                    type="button"
                    title="이름 변경"
                    aria-label="이름 변경"
                    onClick={() => {
                      setPendingCreate(null);
                      setRenamingPath(node.path);
                    }}
                  >
                    <RenameIcon size={14} />
                  </ActionButton>
                  <ActionButton
                    type="button"
                    title="삭제"
                    aria-label="삭제"
                    onClick={() => handleDelete(node)}
                  >
                    <TrashIcon size={14} />
                  </ActionButton>
                </RowActions>
              </Row>
            )}

            {!isCollapsed && (
              <>
                {pendingCreate?.parentDir === node.path && (
                  <InlineInput
                    depth={depth + 1}
                    icon={pendingCreate.kind === 'dir' ? <FolderIcon size={15} /> : <FileIcon size={15} />}
                    initialValue=""
                    onCommit={commitCreate}
                    onCancel={() => setPendingCreate(null)}
                  />
                )}
                {renderNodes(node.children, depth + 1)}
              </>
            )}
          </div>
        );
      }

      // 파일 노드
      if (renamingPath === node.path) {
        return (
          <InlineInput
            key={`file:${node.path}`}
            depth={depth}
            icon={<FileIcon size={15} />}
            initialValue={node.name}
            onCommit={commitRename}
            onCancel={() => setRenamingPath(null)}
          />
        );
      }
      const isLocked = lockedSet.has(node.path);
      return (
        <Row
          key={`file:${node.path}`}
          $active={node.path === activePath}
          $depth={depth}
          role="button"
          tabIndex={0}
          onClick={() => onSelectFile(node.path)}
          onKeyDown={(event) => handleRowKey(event, () => onSelectFile(node.path))}
          title={isLocked ? `${node.path} (잠금 · 편집 불가)` : node.path}
        >
          <FileIndent />
          <NodeIcon>
            <FileIcon size={15} />
          </NodeIcon>
          <NameText>{node.name}</NameText>
          {isLocked ? (
            <Lock aria-label="잠금">
              <LockIcon size={12} />
            </Lock>
          ) : (
            <RowActions data-row-actions onClick={(event) => event.stopPropagation()}>
              <ActionButton
                type="button"
                title="이름 변경"
                aria-label="이름 변경"
                onClick={() => {
                  setPendingCreate(null);
                  setRenamingPath(node.path);
                }}
              >
                <RenameIcon size={14} />
              </ActionButton>
              <ActionButton
                type="button"
                title="삭제"
                aria-label="삭제"
                onClick={() => handleDelete(node)}
              >
                <TrashIcon size={14} />
              </ActionButton>
            </RowActions>
          )}
        </Row>
      );
    });

  return (
    <Container>
      <Toolbar>
        <ToolbarLabel>파일</ToolbarLabel>
        <ToolbarActions>
          <ActionButton
            type="button"
            title="새 파일 (루트)"
            aria-label="새 파일"
            onClick={() => startCreate('', 'file')}
          >
            <NewFileIcon size={15} />
          </ActionButton>
          <ActionButton
            type="button"
            title="새 폴더 (루트)"
            aria-label="새 폴더"
            onClick={() => startCreate('', 'dir')}
          >
            <NewFolderIcon size={15} />
          </ActionButton>
        </ToolbarActions>
      </Toolbar>

      <List>
        {pendingCreate?.parentDir === '' && (
          <InlineInput
            depth={0}
            icon={pendingCreate.kind === 'dir' ? '📁' : '📄'}
            initialValue=""
            onCommit={commitCreate}
            onCancel={() => setPendingCreate(null)}
          />
        )}
        {renderNodes(tree, 0)}
      </List>
    </Container>
  );
}

// ── 인라인 입력 (생성·이름변경 공용) ──────────────────────────────────────────

interface InlineInputProps {
  depth: number;
  icon: React.ReactNode;
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/**
 * 생성/이름변경용 인라인 입력. 입력값은 내부 state로 가져 매 키 입력마다 트리 전체를
 * 다시 그리지 않는다. Enter → 확정(blur 경유), Esc → 취소, blur → 확정(취소 플래그면 취소).
 */
function InlineInput({ depth, icon, initialValue, onCommit, onCancel }: InlineInputProps) {
  const [value, setValue] = useState(initialValue);
  const cancelledRef = useRef(false);

  return (
    <InputRow $depth={depth}>
      <NodeIcon>{icon}</NodeIcon>
      <NameInput
        autoFocus
        value={value}
        spellCheck={false}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            cancelledRef.current = true;
            event.currentTarget.blur();
          }
        }}
        onBlur={() => (cancelledRef.current ? onCancel() : onCommit(value))}
      />
    </InputRow>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

/** 들여쓰기 — 깊이당 12px + 기본 패딩 */
const indentPadding = (depth: number) => `${depth * 12 + 8}px`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const ToolbarLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.xs};
  gap: 2px;
  overflow: auto;
  flex: 1;
  min-height: 0;
`;

const Row = styled.div<{ $active: boolean; $depth: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.xs};
  padding-left: ${({ $depth }) => indentPadding($depth)};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: ${({ theme }) => theme.font.mono};
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }

  /* hover/active 시 행 액션 노출 */
  &:hover > *[data-row-actions],
  &:focus-within > *[data-row-actions] {
    opacity: 1;
  }

  ${({ theme, $active }) =>
    $active &&
    css`
      color: ${theme.colors.text};
      background: ${theme.colors.surfaceAlt};
      border-color: ${theme.colors.border};
    `}
`;

/** 폴더 펼침 화살표 — 접힘 0°, 펼침 90° 회전(부드러운 전환) */
const ChevronToggle = styled.span<{ $expanded: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  color: ${({ theme }) => theme.colors.textMuted};

  svg {
    transition: transform 0.12s ease;
    transform: rotate(${({ $expanded }) => ($expanded ? '90deg' : '0deg')});
  }
`;

/** 파일 행을 폴더 행의 아이콘 위치에 맞추기 위한 chevron 폭만큼의 빈 칸 */
const FileIndent = styled.span`
  flex-shrink: 0;
  width: 16px;
`;

const NodeIcon = styled.span`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const NameText = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Lock = styled.span`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.warning};
`;

const RowActions = styled.span`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s ease;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px 3px;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const InputRow = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.xs};
  padding-left: ${({ $depth }) => indentPadding($depth)};
`;

const NameInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: ${({ theme }) => theme.font.mono};

  &:focus {
    outline: none;
  }
`;
