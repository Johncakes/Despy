/**
 * WorkspacePlaygroundView.tsx — P0/P1 PoC: WebContainer 부팅·편집·미리보기 검증 화면
 *
 * 샘플 Vite+React 템플릿을 useWorkspace로 부팅→install→dev까지 돌리고, 좌측
 * 에디터(파일트리+Monaco) ↔ 우측 미리보기(+콘솔)를 나란히 보여준다. 좌측에서
 * 파일을 편집하면 FS로 동기화되어 우측 미리보기가 HMR로 즉시 갱신된다(P1 핵심).
 *
 * 'AI 미러링 (데모)' 버튼은 AI가 코드를 작성하는 경로를 모사한다 — 학생 편집과
 * 동일한 writeFile 경로를 타므로, 실제 AiChatPanel 연결 시 AI 편집 적용
 * (onApplyAiEdits)을 writeFile로 잇기만 하면 된다(구 Problem 모델 의존 제거 후 P4에서 연결).
 *
 * 사용처: app/playground/page.tsx
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import {
  VITE_REACT_SAMPLE_TEMPLATE,
  VITE_REACT_SAMPLE_LOCKED_PATHS,
} from '@/shared/core/constants/webcontainerTemplates';
import { Button } from '@/shared/components/ui/Button';
import { useWorkspace } from '@/features/solve/useWorkspace';
import { WorkspaceEditorPanel } from '@/features/solve/components/WorkspaceEditorPanel';
import { WorkspacePanel } from '@/features/solve/components/WorkspacePanel';

// ── Constants ─────────────────────────────────────────────────────────────

/** 데모에서 AI가 '작성'할 대상 파일 */
const AI_DEMO_TARGET_PATH = 'src/App.jsx';

/** AI가 작성했다고 가정하는 코드(누적 카운터를 헤딩에 반영해 HMR 변화를 눈으로 확인) */
function buildAiDemoCode(revision: number): string {
  return `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <h1>despy 🤖 AI가 작성함 (rev ${revision})</h1>
      <p>이 코드는 'AI 미러링 데모' 버튼이 writeFile로 작성했습니다 — 학생 편집과 같은 경로.</p>
      <button onClick={() => setCount((value) => value + 1)}>
        count is {count}
      </button>
      <p className="hint">버튼을 누를 때마다 rev가 오르고 미리보기가 HMR로 갱신됩니다.</p>
    </main>
  );
}
`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function WorkspacePlaygroundView() {
  const workspace = useWorkspace(VITE_REACT_SAMPLE_TEMPLATE, VITE_REACT_SAMPLE_LOCKED_PATHS);
  const [aiRevision, setAiRevision] = useState(0);

  const handleAiMirrorDemo = () => {
    const nextRevision = aiRevision + 1;
    setAiRevision(nextRevision);
    // AI 미러링과 동일 경로: 대상 파일을 열고 writeFile로 갱신 → FS → HMR.
    workspace.setActivePath(AI_DEMO_TARGET_PATH);
    workspace.writeFile(AI_DEMO_TARGET_PATH, buildAiDemoCode(nextRevision));
  };

  return (
    <Wrapper>
      <TopBar>
        <BackLink href="/">← 홈</BackLink>
        <Title>WebContainer PoC</Title>
        <Caption>편집 → FS → HMR 미리보기 (P1)</Caption>
        <Spacer />
        <Button variant="ghost" onClick={handleAiMirrorDemo} disabled={workspace.phase !== 'ready'}>
          AI 미러링 (데모)
        </Button>
      </TopBar>

      <Body>
        <EditorColumn>
          <WorkspaceEditorPanel
            files={workspace.files}
            activePath={workspace.activePath}
            lockedPaths={workspace.lockedPaths}
            onSelectFile={workspace.setActivePath}
            onEditActiveFile={(contents) =>
              workspace.writeFile(workspace.activePath, contents)
            }
          />
        </EditorColumn>

        <PreviewColumn>
          <WorkspacePanel
            phase={workspace.phase}
            logs={workspace.logs}
            previewUrl={workspace.previewUrl}
            errorMessage={workspace.errorMessage}
            onRetry={workspace.retry}
            testResult={workspace.testResult}
            isRunningTests={workspace.isRunningTests}
            testErrorMessage={workspace.testErrorMessage}
            onRunTests={() => void workspace.runTests()}
          />
        </PreviewColumn>
      </Body>
    </Wrapper>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: ${({ theme }) => theme.spacing.md};
`;

const TopBar = styled.header`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
`;

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
`;

const Caption = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Spacer = styled.div`
  flex: 1;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;

const EditorColumn = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

const PreviewColumn = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
`;
