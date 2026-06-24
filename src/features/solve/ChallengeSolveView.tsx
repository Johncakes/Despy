/**
 * ChallengeSolveView.tsx — 학생 과제 풀이 화면 오케스트레이터 (WebContainer 피벗)
 *
 * 좌(과제 지문) · 중(AI 도우미, 주역) · 우(워크스페이스: 에디터 + 미리보기) 3열
 * 레이아웃을 구성한다. 우측 워크스페이스는 useWorkspace로 WebContainer를 부팅해
 * 에디터 편집·AI 미러링을 모두 같은 writeFile 경로로 FS에 반영하고, Vite HMR로
 * 미리보기를 실시간 갱신한다(P1 핵심). AI가 작성한 코드펜스는 활성 파일에 미러링된다.
 *
 * ⚠️ AI 사용량(질문/토큰)은 P1에서 in-memory 상태로 추적한다(새로고침 시 초기화).
 *    영속(despy-workspace)·제출/채점은 P2~P4에서 도입한다(docs/spec-webcontainer.md).
 *
 * 사용처: app/workspace/[challengeId]/page.tsx
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styled, { css } from 'styled-components';
import type { ChallengeProblem } from '@/shared/core/types';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { useWorkspace } from '@/features/solve/useWorkspace';
import { AiChatPanel } from '@/features/solve/components/AiChatPanel';
import { ChallengeStatementPanel } from '@/features/solve/components/ChallengeStatementPanel';
import { WorkspaceEditorPanel } from '@/features/solve/components/WorkspaceEditorPanel';
import { WorkspacePanel } from '@/features/solve/components/WorkspacePanel';

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeSolveView({ challenge }: { challenge: ChallengeProblem }) {
  const workspace = useWorkspace(challenge.template, challenge.lockedPaths);
  const { writeFile, activePath } = workspace;

  // AI 사용량(P1 in-memory) · 패널 토글 상태
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [isAiOpen, setIsAiOpen] = useState(true);
  const [isDirectEditEnabled, setIsDirectEditEnabled] = useState(true);
  const [isAiWriting, setIsAiWriting] = useState(false);

  // 미러링 콜백을 안정화(useCallback)해 AiChatPanel의 미러링 effect가 매 렌더
  // 재실행되지 않게 한다. 활성 파일 경로는 ref로 읽어 콜백을 재생성하지 않는다.
  // (ref 갱신은 렌더 중이 아니라 effect에서 수행 — react-hooks/refs 규칙)
  const activePathRef = useRef(activePath);
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  const handleAiCodeStreamStart = useCallback(() => {
    setIsAiWriting(true);
  }, []);

  const handleAiCodeStream = useCallback(
    (code: string) => {
      // AI가 쓴 코드펜스를 현재 활성 파일에 미러링 → FS → HMR.
      writeFile(activePathRef.current, code);
    },
    [writeFile],
  );

  const handleAiCodeStreamEnd = useCallback(() => {
    setIsAiWriting(false);
  }, []);

  const handleTurnComplete = useCallback((totalTokens: number) => {
    setQuestionsUsed((count) => count + 1);
    setTokensUsed((total) => total + totalTokens);
  }, []);

  return (
    <Wrapper>
      <TopBar>
        <BackLink href="/">← 목록</BackLink>
        <Title>{challenge.title}</Title>
        <Badge tone="neutral">제출·채점은 P2~ 예정</Badge>
        {!isAiOpen && (
          <Button variant="ghost" onClick={() => setIsAiOpen(true)}>
            AI 도우미 열기
          </Button>
        )}
      </TopBar>

      <Body>
        <StatementColumn>
          <ChallengeStatementPanel
            title={challenge.title}
            statement={challenge.statement}
          />
        </StatementColumn>

        <AiColumn $isOpen={isAiOpen}>
          <AiChatPanel
            aiPolicy={challenge.aiPolicy}
            questionsUsed={questionsUsed}
            tokensUsed={tokensUsed}
            isOpen={isAiOpen}
            onToggle={() => setIsAiOpen((open) => !open)}
            onTurnComplete={handleTurnComplete}
            isDirectEditEnabled={isDirectEditEnabled}
            onToggleDirectEdit={() => setIsDirectEditEnabled((enabled) => !enabled)}
            onAiCodeStreamStart={handleAiCodeStreamStart}
            onAiCodeStream={handleAiCodeStream}
            onAiCodeStreamEnd={handleAiCodeStreamEnd}
          />
        </AiColumn>

        <WorkspaceColumn>
          <EditorArea>
            <WorkspaceEditorPanel
              files={workspace.files}
              activePath={workspace.activePath}
              lockedPaths={workspace.lockedPaths}
              onSelectFile={workspace.setActivePath}
              onEditActiveFile={(contents) =>
                workspace.writeFile(workspace.activePath, contents)
              }
              isAiWriting={isAiWriting}
            />
          </EditorArea>
          <PreviewArea>
            <WorkspacePanel
              phase={workspace.phase}
              logs={workspace.logs}
              previewUrl={workspace.previewUrl}
              errorMessage={workspace.errorMessage}
              onRetry={workspace.retry}
            />
          </PreviewArea>
        </WorkspaceColumn>
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
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Title = styled.h1`
  flex: 1;
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;

const StatementColumn = styled.div`
  width: 320px;
  min-height: 0;
  flex-shrink: 0;
`;

// AI 채팅은 가운데 주역 — 열려 있으면 넓게, 접으면 얇은 바(44px)로 축소.
const AiColumn = styled.div<{ $isOpen: boolean }>`
  min-height: 0;
  display: flex;
  ${({ $isOpen }) =>
    $isOpen
      ? css`
          flex: 1;
          min-width: 340px;
        `
      : css`
          flex: 0 0 44px;
        `}
`;

const WorkspaceColumn = styled.div`
  flex: 1.4;
  min-width: 460px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const EditorArea = styled.div`
  flex: 1.2;
  min-height: 0;
`;

const PreviewArea = styled.div`
  flex: 1;
  min-height: 0;
`;
