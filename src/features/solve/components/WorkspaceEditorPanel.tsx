/**
 * WorkspaceEditorPanel.tsx — 파일트리 + Monaco 에디터 (WebContainer 워크스페이스용)
 *
 * 왼쪽 파일트리에서 파일을 고르고 오른쪽 Monaco로 편집한다. 편집 내용은 콜백으로
 * 상위(useWorkspace)에 전달되어 FS로 동기화된다(→ HMR). 잠금 파일은 열어 볼 수는
 * 있으나 read-only다. 상태를 갖지 않는 제어 컴포넌트(파일 버퍼/활성 파일은 상위 소유).
 *
 * Monaco는 window 의존이라 next/dynamic(ssr:false)로 클라이언트에서만 로드한다.
 * 파일마다 별도 모델을 유지하도록 `path` prop을 넘겨 되돌리기 히스토리를 보존한다.
 *
 * 사용처: features/solve/WorkspacePlaygroundView (PoC), features/solve/ChallengeSolveView (P1)
 */
'use client';

import dynamic from 'next/dynamic';
import styled from 'styled-components';
import type { ProjectFiles } from '@/shared/core/types';
import { Panel } from '@/shared/components/ui/Panel';
import { Badge } from '@/shared/components/ui/Badge';
import { FileTree } from '@/features/solve/components/FileTree';

// Monaco는 window 의존 → 클라이언트에서만 로드
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <EditorLoading>에디터 로딩 중…</EditorLoading>,
});

// ── Constants ─────────────────────────────────────────────────────────────

/** 파일 확장자 → Monaco 언어 모드 */
const EXTENSION_TO_MONACO: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  css: 'css',
  html: 'html',
  md: 'markdown',
};

// ── Types ─────────────────────────────────────────────────────────────────

interface WorkspaceEditorPanelProps {
  files: ProjectFiles;
  activePath: string;
  lockedPaths: readonly string[];
  onSelectFile: (path: string) => void;
  /** 활성 파일 내용 변경 (상위가 버퍼+FS 동기화) */
  onEditActiveFile: (contents: string) => void;
  /** 빈 새 파일 생성 (전체 경로) */
  onCreateFile: (path: string) => void;
  /** 파일/폴더(경로 프리픽스) 삭제 */
  onDeletePath: (path: string) => void;
  /** 파일/폴더 경로 변경(이동) */
  onRenamePath: (fromPath: string, toPath: string) => void;
  /** AI가 코드를 실시간 작성하는 중이면 에디터를 read-only로 잠가 충돌을 막는다 */
  isAiWriting?: boolean;
  /** 헤더 우측 액션(예: AI 미러링 데모 버튼) */
  actions?: React.ReactNode;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function monacoLanguageForPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MONACO[extension] ?? 'plaintext';
}

// ── Component ─────────────────────────────────────────────────────────────

export function WorkspaceEditorPanel({
  files,
  activePath,
  lockedPaths,
  onSelectFile,
  onEditActiveFile,
  onCreateFile,
  onDeletePath,
  onRenamePath,
  isAiWriting = false,
  actions,
}: WorkspaceEditorPanelProps) {
  const isActiveLocked = lockedPaths.includes(activePath);
  const isReadOnly = isActiveLocked || isAiWriting;

  return (
    <Panel
      title={
        <TitleRow>
          <span>에디터</span>
          {isActiveLocked && <Badge tone="warning">잠금 · 읽기 전용</Badge>}
          {isAiWriting && !isActiveLocked && <Badge tone="info">AI 작성 중…</Badge>}
        </TitleRow>
      }
      actions={actions}
      isBodyFlush
    >
      <Layout>
        <Sidebar>
          <FileTree
            paths={Object.keys(files)}
            activePath={activePath}
            lockedPaths={lockedPaths}
            onSelectFile={onSelectFile}
            onCreateFile={onCreateFile}
            onDeletePath={onDeletePath}
            onRenamePath={onRenamePath}
          />
        </Sidebar>
        <EditorHost>
          <MonacoEditor
            height="100%"
            theme="vs-dark"
            path={activePath}
            language={monacoLanguageForPath(activePath)}
            value={files[activePath] ?? ''}
            onChange={(value) => onEditActiveFile(value ?? '')}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              readOnly: isReadOnly,
            }}
          />
        </EditorHost>
      </Layout>
    </Panel>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Layout = styled.div`
  display: flex;
  height: 100%;
  min-height: 0;
`;

const Sidebar = styled.div`
  width: 220px;
  flex-shrink: 0;
  min-height: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
`;

const EditorHost = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

const EditorLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
`;
