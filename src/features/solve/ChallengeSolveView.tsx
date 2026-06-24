/**
 * ChallengeSolveView.tsx — 학생 과제 풀이 화면 오케스트레이터 (WebContainer 피벗)
 *
 * 좌(과제 지문) · 중(AI 도우미, 주역) · 우(워크스페이스: 에디터 + 미리보기) 3열
 * 레이아웃을 구성한다. 우측 워크스페이스는 useWorkspace로 WebContainer를 부팅해
 * 에디터 편집·AI 코드 반영을 모두 같은 writeFile 경로로 FS에 반영하고, Vite HMR로
 * 미리보기를 실시간 갱신한다(P1 핵심). AI 답변의 SEARCH/REPLACE 편집은 현재 파일에서
 * 정확히 일치하는 부분만 교체해 반영한다(handleApplyAiEdits → markdownCode.applyFileEdit).
 *
 * 제출(P3): 상단 바의 '제출'이 자동 테스트 결과 + 변경 파일 + 루브릭을 /api/grade로
 * 보내(useGradeChallenge) 공식 채점을 받고, 결과를 모달(ChallengeGradingResultPanel)로
 * 보여준다. testResult가 없으면 제출 전에 runTests()를 먼저 돌려 자동 테스트 신호를 채운다.
 *
 * 영속(P4): 파일 편집 버퍼(델타)와 AI 사용량(질문/토큰)은 useWorkspace를 통해
 *    challengeId별로 IndexedDB(despy-workspace)에 저장·복원된다 — 새로고침해도
 *    진행이 유지된다(docs/spec-webcontainer.md §9.1).
 *
 * 제출 기록: 채점 성공 시 결과를 입력한 이름/별명과 함께 submissionStore에 저장해
 *    교수 채점 대시보드(GradingDashboardView)의 데이터 소스가 되게 한다.
 *
 * 사용처: app/workspace/[challengeId]/page.tsx
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled, { css } from 'styled-components';
import type {
  ChallengeGradingResult,
  ChallengeProblem,
  ProjectFiles,
} from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';
import { useGradeChallenge } from '@/shared/core/queries/gradeQueries';
import {
  useSubmissionStore,
  type SubmissionPromptTurn,
} from '@/shared/core/stores/submissionStore';
import { applyFileEdit, type FileEdit } from '@/shared/lib/utils/markdownCode';
import { useWorkspace } from '@/features/solve/useWorkspace';
import {
  AiChatPanel,
  type EditApplyReport,
} from '@/features/solve/components/AiChatPanel';
import { ChallengeGradingResultPanel } from '@/features/solve/components/ChallengeGradingResultPanel';
import { ChallengeStatementPanel } from '@/features/solve/components/ChallengeStatementPanel';
import { WorkspaceEditorPanel } from '@/features/solve/components/WorkspaceEditorPanel';
import { WorkspacePanel } from '@/features/solve/components/WorkspacePanel';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * 채점에 보낼 제출 파일(변경 파일만)을 모은다 — 템플릿 대비 내용이 바뀐(또는 새로
 * 추가된) 편집 가능 파일만 남긴다. 잠금 파일·미변경 파일은 제외해 채점 프롬프트의
 * 토큰·노이즈를 줄이고 채점관이 학생 기여에 집중하게 한다(docs §7.2).
 */
function collectChangedFiles(
  files: ProjectFiles,
  template: ProjectFiles,
  lockedPaths: readonly string[],
): ProjectFiles {
  const locked = new Set(lockedPaths);
  const changed: ProjectFiles = {};
  for (const [path, contents] of Object.entries(files)) {
    if (locked.has(path)) continue;
    if (contents !== template[path]) changed[path] = contents;
  }
  return changed;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeSolveView({ challenge }: { challenge: ChallengeProblem }) {
  const router = useRouter();
  const workspace = useWorkspace(
    challenge.template,
    challenge.lockedPaths,
    challenge.id,
  );
  const { writeFile, activePath, files, testResult, runTests } = workspace;
  // AI 사용량은 워크스페이스(영속, P4)에서 읽는다 — 새로고침해도 유지된다.
  const { questionsUsed, tokensUsed, recordAiTurn } = workspace;
  const grade = useGradeChallenge();

  // 패널 토글 상태(UI 전용 — 영속 대상 아님)
  const [isAiOpen, setIsAiOpen] = useState(true);
  const [isDirectEditEnabled, setIsDirectEditEnabled] = useState(true);
  const [isAiWriting, setIsAiWriting] = useState(false);

  // 제출/채점(P3) 상태 — 결과 모달과 제출 에러.
  const [gradingResult, setGradingResult] = useState<ChallengeGradingResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 제출자 이름/별명 — 채점 대시보드에서 제출을 구분하는 식별자(인증 없음, 입력 의존).
  const [studentName, setStudentName] = useState('');

  // ── 이탈 방지 (WebContainer 재설치 방지) ─────────────────────────────────
  // WebContainer가 준비된(또는 준비 중인) 상태에서 페이지를 새로고침하거나 탭을
  // 닫으면 node_modules가 사라져 재진입 시 npm install이 다시 돌아간다. 실수로
  // 이탈하는 것을 막기 위해 beforeunload 확인 대화상자를 건다.
  useEffect(() => {
    if (workspace.phase === 'idle') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [workspace.phase]);

  // ← 목록 뒤로가기 시 확인 대화상자. WebContainer가 활성이면 나가면 재설치해야
  // 함을 알려준다. 확인하면 클라이언트 라우팅으로 이동(WebContainer는 언마운트).
  const handleBackToList = useCallback(() => {
    if (
      workspace.phase !== 'idle' &&
      workspace.phase !== 'error' &&
      !window.confirm(
        '목록으로 나가면 워크스페이스를 다시 준비해야 합니다.\n계속하시겠습니까?',
      )
    ) {
      return;
    }
    router.push('/');
  }, [workspace.phase, router]);

  // 미러링 콜백을 안정화(useCallback)해 AiChatPanel의 미러링 effect가 매 렌더
  // 재실행되지 않게 한다. 활성 파일 경로·파일 버퍼는 ref로 읽어 콜백을 재생성하지
  // 않는다. (ref 갱신은 렌더 중이 아니라 effect에서 수행 — react-hooks/refs 규칙)
  const activePathRef = useRef(activePath);
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const handleAiCodeStreamStart = useCallback(() => {
    setIsAiWriting(true);
  }, []);

  const handleApplyAiEdits = useCallback(
    (edits: FileEdit[]): EditApplyReport => {
      // SEARCH/REPLACE 편집들을 현재 파일에 적용한다. 경로별로 최신 내용에 순차 적용하고
      // (같은 파일 여러 편집 누적), SEARCH가 정확히 1곳 일치할 때만 교체된다. AI가 적은
      // 경로가 파일트리에 실제로 있을 때만 그 파일에, 없으면 활성 파일에 적용한다.
      let applied = 0;
      let failed = 0;
      const working: Record<string, string> = {};
      for (const edit of edits) {
        const targetPath =
          edit.path && filesRef.current[edit.path] !== undefined
            ? edit.path
            : activePathRef.current;
        const base = working[targetPath] ?? filesRef.current[targetPath] ?? '';
        const result = applyFileEdit(base, edit.search, edit.replace);
        if (result.ok) {
          working[targetPath] = result.content;
          applied += 1;
        } else {
          failed += 1;
        }
      }
      // 파일별 최종 내용을 한 번에 반영 → FS → HMR. 잠금 파일이면 writeFile이 무시.
      for (const [path, content] of Object.entries(working)) {
        writeFile(path, content);
      }
      return { applied, failed };
    },
    [writeFile],
  );

  const handleAiCodeStreamEnd = useCallback(() => {
    setIsAiWriting(false);
  }, []);

  const handleTurnComplete = useCallback(
    (totalTokens: number) => {
      recordAiTurn(totalTokens);
    },
    [recordAiTurn],
  );

  // 제출 시 기록할 AI 대화 트랜스크립트를 ref에 보관한다(스트리밍 중 자주 갱신되므로
  // state 대신 ref로 받아 재렌더를 피한다 — 제출 시점에만 읽으면 충분).
  const promptsRef = useRef<SubmissionPromptTurn[]>([]);
  const handleMessagesChange = useCallback((transcript: SubmissionPromptTurn[]) => {
    promptsRef.current = transcript;
  }, []);

  // 질문에 첨부할 현재 코드 상태 — 지금 에디터에 열린 활성 파일의 경로+내용을 보낸다.
  // 전송 시점에 호출되므로 최신 버퍼를 ref로 읽어 콜백 재생성을 피한다.
  const getCodeContext = useCallback(() => {
    const path = activePathRef.current;
    const contents = filesRef.current[path] ?? '';
    return `현재 편집 중인 파일: ${path}\n\`\`\`\n${contents}\n\`\`\``;
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    try {
      // autoTest는 채점의 필수 신호다 — 아직 안 돌렸으면 제출 전에 한 번 실행한다(§7.2).
      // runTests가 실패하면(타임아웃 등) throw되어 아래 catch에서 제출을 중단한다.
      const autoTest = testResult ?? (await runTests());
      const submittedFiles = collectChangedFiles(
        files,
        challenge.template,
        challenge.lockedPaths,
      );
      const result = await grade.mutateAsync({
        problemId: challenge.id,
        statement: challenge.statement,
        rubric: challenge.rubric,
        submittedFiles,
        autoTest,
        // 모델은 과제 AI 정책을 따르되, aiPolicy.systemPrompt(답변 가드레일)는 채점
        // 가드레일이 아니므로 보내지 않는다 — grader의 기본 채점 프롬프트를 쓴다.
        model: challenge.aiPolicy.model,
      });
      setGradingResult(result);
      // 채점 결과를 제출 기록으로 저장 → 교수 대시보드 데이터 소스. 이름은 비우면 '익명'.
      useSubmissionStore.getState().addSubmission(challenge.id, {
        id: crypto.randomUUID(),
        studentName: studentName.trim() || '익명',
        result,
        // 제출 시점의 코드(변경분)와 AI 대화를 함께 저장 → 대시보드에서 열람.
        submittedFiles,
        prompts: promptsRef.current,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(message);
    }
  }, [testResult, runTests, files, challenge, grade, studentName]);

  // 워크스페이스가 준비되어야(테스트 실행 가능) 제출할 수 있다.
  const isSubmitting = grade.isPending;
  const canSubmit =
    workspace.phase === 'ready' && !isSubmitting && !workspace.isRunningTests;
  const submitLabel = isSubmitting
    ? '채점 중…'
    : workspace.isRunningTests
      ? '테스트 실행 중…'
      : '제출';

  return (
    <Wrapper>
      <TopBar>
        <BackButton type="button" onClick={handleBackToList}>← 목록</BackButton>
        <Title>{challenge.title}</Title>
        {submitError && <ErrorText title={submitError}>{submitError}</ErrorText>}
        {!isAiOpen && (
          <Button variant="ghost" onClick={() => setIsAiOpen(true)}>
            AI 도우미 열기
          </Button>
        )}
        <NameInput
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
          placeholder="이름/별명"
          aria-label="제출자 이름/별명"
          maxLength={40}
        />
        <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
          {submitLabel}
        </Button>
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
            onApplyAiEdits={handleApplyAiEdits}
            onAiCodeStreamEnd={handleAiCodeStreamEnd}
            getCodeContext={getCodeContext}
            onMessagesChange={handleMessagesChange}
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
              testResult={workspace.testResult}
              isRunningTests={workspace.isRunningTests}
              testErrorMessage={workspace.testErrorMessage}
              onRunTests={() => void workspace.runTests()}
            />
          </PreviewArea>
        </WorkspaceColumn>
      </Body>

      {gradingResult && (
        <ChallengeGradingResultPanel
          result={gradingResult}
          criteria={challenge.rubric.criteria}
          weights={challenge.rubric.weights}
          onClose={() => setGradingResult(null)}
        />
      )}
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

const BackButton = styled.button`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Title = styled.h1`
  flex: 1;
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
`;

// 제출자 이름 입력 — 상단 바에서 제출 버튼 옆. 좁게 두어 레이아웃을 차지하지 않는다.
const NameInput = styled.input`
  width: 140px;
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

// 제출 실패 메시지 — 길면 줄임표로 잘라 상단 바 레이아웃을 깨지 않는다(전문은 title 속성).
const ErrorText = styled.span`
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
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
