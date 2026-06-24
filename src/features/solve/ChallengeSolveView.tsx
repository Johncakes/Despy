/**
 * ChallengeSolveView.tsx — 학생 과제 풀이 화면 오케스트레이터 (WebContainer 피벗)
 *
 * 좌(과제 지문) · 중(AI 에이전트, 주역) · 우(워크스페이스: 에디터 + 미리보기) 3열
 * 레이아웃을 구성한다. 우측 워크스페이스는 useWorkspace로 WebContainer를 부팅해
 * 에디터 편집·AI 코드 반영을 모두 같은 writeFile 경로로 FS에 반영하고, Vite HMR로
 * 미리보기를 실시간 갱신한다(P1 핵심). AI 답변의 SEARCH/REPLACE 편집은 현재 파일에서
 * 정확히 일치하는 부분만 교체해 반영한다(handleApplyAiEdits → markdownCode.applyFileEdit).
 *
 * 제출(M4): 상단 바의 '제출'이 자동 테스트 결과 + 변경 파일 + 대화·사용량을
 *    서버로 보내(useSubmitChallenge → POST /api/challenges/[id]/submissions) 공식 채점을
 *    받고, 반환된 Submission.result를 모달(ChallengeGradingResultPanel)로 보여준다.
 *    채점 기준(루브릭)은 클라이언트가 보내지 않고 서버가 저장된 과제로 확정한다(무결성).
 *    testResult가 없으면 제출 전에 runTests()를 먼저 돌려 자동 테스트 신호를 채운다.
 *
 * 영속(P4): 파일 편집 버퍼(델타)와 AI 사용량(질문/토큰)은 useWorkspace를 통해
 *    challengeId별로 IndexedDB(despy-workspace)에 저장·복원된다 — 새로고침해도
 *    진행이 유지된다(docs/spec-webcontainer.md §9.1).
 *
 * 제출 기록(M4): 제출은 서버가 영속한다 — 제출자 신원은 입력칸이 아니라 인증 세션에서
 *    오며, 그 결과가 교수 채점 대시보드(GradingDashboardView)의 데이터 소스가 된다.
 *    studentName은 더 이상 클라이언트가 보내지 않는다(서버 세션이 채움 — 위장 방지).
 *
 * 사용처: app/workspace/[challengeId]/page.tsx
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled, { css, keyframes } from 'styled-components';
import type {
  AutoTestResult,
  ChallengeGradingResult,
  ChallengeSubmitRequest,
  ProjectFiles,
  StudentChallenge,
  SubmissionPromptTurn,
} from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';
import { useCurrentUser } from '@/shared/core/queries/authQueries';
import { useSubmitChallenge } from '@/shared/core/queries/submissionQueries';
import { useProctoringMonitor } from '@/shared/lib/hooks/useProctoringMonitor';
import {
  FullscreenPrompt,
  ProctoringNotice,
  AnomalyBadge,
} from '@/features/solve/components/ProctoringControls';
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

/** ML 챌린지 제출의 객관 축은 성능 점수(mlScore)다 — 자동 테스트는 비운다(채점에서 무시). */
const EMPTY_AUTO_TEST: AutoTestResult = { passedCount: 0, totalCount: 0, cases: [] };

/**
 * 결과 모달의 '점수 산출 내역' 표시용 폴백 가중치 — 학생 DTO에 루브릭(가중치)이 없고
 * 채점 결과에도 담겨오지 않아, 산출 내역의 축별 기여도를 균등(0.5/0.5)으로 표시한다.
 * 최종 점수(finalScore)는 서버 확정값을 그대로 보여주므로 이 폴백과 무관하게 정확하다.
 */
const FALLBACK_RESULT_WEIGHTS = { tests: 0.5, rubric: 0.5 } as const;

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeSolveView({ challenge }: { challenge: StudentChallenge }) {
  const router = useRouter();
  // ML 챌린지면 평가 설정(MlSpec + 숨긴 test셋)을 워크스페이스에 넘긴다 — dev 서버를
  // 띄우지 않고 runEvaluation으로 성능을 채점한다. StudentChallenge에서 ml·testFiles는
  // kind==='ml'일 때만 존재하므로(타입상 선택), 워크스페이스 과제는 undefined를 넘기고
  // (동작 불변) ML 과제만 spec+testFiles를 넘긴다(ML은 항상 두 값을 가지므로 ?? {}로 보강).
  const mlConfig = useMemo(
    () =>
      challenge.kind === 'ml' && challenge.ml
        ? { spec: challenge.ml, testFiles: challenge.testFiles ?? {} }
        : undefined,
    [challenge.kind, challenge.ml, challenge.testFiles],
  );
  const workspace = useWorkspace(
    challenge.template,
    challenge.lockedPaths,
    challenge.id,
    mlConfig,
  );
  const { writeFile, activePath, files, testResult, runTests } = workspace;
  const { runEvaluation, evalResult } = workspace;
  // AI 사용량은 워크스페이스(영속, P4)에서 읽는다 — 새로고침해도 유지된다.
  const { questionsUsed, tokensUsed, recordAiTurn } = workspace;
  // 제출자 신원은 로그인 세션에서 가져온다 — 학생이 직접 타이핑하지 않는다(위장 방지).
  const { data: currentUser } = useCurrentUser();
  const submit = useSubmitChallenge();
  const { log: integrityLog, isFullscreen, requestFullscreen, getLog } = useProctoringMonitor();

  // 패널 토글 상태(UI 전용 — 영속 대상 아님)
  const [isStatementOpen, setIsStatementOpen] = useState(true);
  const [isDirectEditEnabled, setIsDirectEditEnabled] = useState(true);
  const [isAiWriting, setIsAiWriting] = useState(false);

  // 제출/채점(P3) 상태 — 결과 모달과 제출 에러.
  const [gradingResult, setGradingResult] = useState<ChallengeGradingResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 채점 진행 표시용 경과 시간(초) — 단발 LLM 호출이라 실제 %는 없고, 경과 시간으로
  // "동작 중"임을 정직하게 알린다(아래 progress 오버레이).
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
  // 각 user 턴에는 그 프롬프트를 **작성한 시점**의 코드 스냅샷(변경 델타)을 부착한다:
  // transcript는 매 청크마다 새로 오므로, 기존 user 턴의 스냅샷은 보존하고(처음 전송 때 찍힘)
  // 새로 생긴 user 턴에만 지금 코드 상태를 찍는다. 대시보드가 연속 스냅샷으로 diff를 만든다.
  const promptsRef = useRef<SubmissionPromptTurn[]>([]);
  const handleMessagesChange = useCallback(
    (transcript: SubmissionPromptTurn[]) => {
      const prev = promptsRef.current;
      promptsRef.current = transcript.map((turn, index) => {
        if (turn.role !== 'user') return turn;
        const before = prev[index];
        const filesAtSend =
          before?.role === 'user' && before.filesAtSend
            ? before.filesAtSend // 이미 전송 시점에 찍어둔 스냅샷 유지
            : collectChangedFiles(filesRef.current, challenge.template, challenge.lockedPaths);
        return { ...turn, filesAtSend };
      });
    },
    [challenge.template, challenge.lockedPaths],
  );

  // 질문에 첨부할 현재 코드 상태 — 지금 에디터에 열린 활성 파일의 경로+내용을 보낸다.
  // 전송 시점에 호출되므로 최신 버퍼를 ref로 읽어 콜백 재생성을 피한다.
  const getCodeContext = useCallback(() => {
    const path = activePathRef.current;
    const contents = filesRef.current[path] ?? '';
    return `현재 편집 중인 파일: ${path}\n\`\`\`\n${contents}\n\`\`\``;
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setElapsedSeconds(0); // 진행 오버레이 경과 시간 초기화(처리 시작 시점).
    try {
      // 객관 축 신호를 준비한다 — ML은 성능 평가(숨긴 test셋), 일반 과제는 자동 테스트.
      let autoTest: AutoTestResult = EMPTY_AUTO_TEST;
      let mlScore: ChallengeSubmitRequest['mlScore'];
      if (challenge.kind === 'ml' && challenge.ml) {
        // 이미 '성능 점수' 탭에서 평가했으면 그 값을, 아니면 지금 평가를 실행한다.
        const evalRes = evalResult ?? (await runEvaluation());
        if (!evalRes) {
          setSubmitError(
            workspace.evalErrorMessage ??
              '성능 평가에 실패했습니다. model.mjs가 올바른지 확인하세요.',
          );
          return;
        }
        mlScore = {
          metric: evalRes.metric,
          value: evalRes.value,
          passThreshold: challenge.ml.passThreshold,
        };
      } else {
        // autoTest는 채점의 필수 신호다 — 아직 안 돌렸으면 제출 전에 한 번 실행한다(§7.2).
        // runTests가 실패하면(타임아웃 등) throw되어 아래 catch에서 제출을 중단한다.
        autoTest = testResult ?? (await runTests());
      }

      const submittedFiles = collectChangedFiles(
        files,
        challenge.template,
        challenge.lockedPaths,
      );
      // 서버 제출 — 채점 기준(루브릭·statement·모델)은 보내지 않는다(서버가 저장된
      // 과제로 채점·영속). 제출 코드·자동 테스트·ML 점수·AI 대화·사용량·감독 로그만
      // 보낸다. studentName은 서버 세션이 채우므로 클라이언트가 보내지 않는다.
      const request: ChallengeSubmitRequest = {
        submittedFiles,
        autoTest,
        // ML 챌린지면 성능 점수(객관)를 함께 보내 서버가 합격 판정 + 최종 점수에 반영한다.
        mlScore,
        // 제출 시점까지의 AI 대화(프롬프트+응답)와 사용량·감독 로그 → 교수 대시보드 소스.
        prompts: promptsRef.current,
        aiUsage: { questionsUsed, tokensUsed },
        integrityLog: getLog(),
      };
      const submission = await submit.mutateAsync({
        challengeId: challenge.id,
        request,
      });
      // 반환된 Submission이 공식 채점 결과(result)를 담는다 — 결과 모달에 그대로 보여준다.
      setGradingResult(submission.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(message);
    }
  }, [
    testResult,
    runTests,
    evalResult,
    runEvaluation,
    workspace.evalErrorMessage,
    files,
    challenge,
    submit,
    questionsUsed,
    tokensUsed,
    getLog,
  ]);

  // 워크스페이스가 준비되어야(테스트/평가 실행 가능) 제출할 수 있다.
  const isSubmitting = submit.isPending;
  const canSubmit =
    workspace.phase === 'ready' &&
    !isSubmitting &&
    !workspace.isRunningTests &&
    !workspace.isRunningEval;
  const submitLabel = isSubmitting
    ? '채점 중…'
    : workspace.isRunningEval
      ? '평가 실행 중…'
      : workspace.isRunningTests
        ? '테스트 실행 중…'
        : '제출';

  // 제출 처리(테스트/평가 실행 → AI 채점)는 응답까지 수십 초 걸릴 수 있어, 진행 중임을
  // 정직하게 알리는 오버레이를 띄운다. 단발 LLM 호출이라 실제 진척 %는 없으므로
  // 현재 단계 라벨 + 경과 시간으로 "멈춘 게 아니라 동작 중"임을 전한다.
  const isProcessingSubmit =
    isSubmitting || workspace.isRunningTests || workspace.isRunningEval;
  const progressStageLabel = workspace.isRunningEval
    ? '모델 학습 + 성능 평가 실행 중…'
    : workspace.isRunningTests
      ? '자동 테스트 실행 중…'
      : 'AI가 채점하는 중…';
  // 경과 시간 카운터는 처리 중일 때만 1초마다 갱신한다. 0으로의 리셋은 제출 시작
  // 시점(handleSubmit)에서 하고, 여기서는 비동기 콜백으로만 setState 한다
  // (effect 본문에서의 동기 setState 금지 규칙).
  useEffect(() => {
    if (!isProcessingSubmit) return;
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isProcessingSubmit]);

  return (
    <Wrapper>
      <FullscreenPrompt isFullscreen={isFullscreen} onRequestFullscreen={requestFullscreen} />
      <ProctoringNotice reportedToInstructor />
      <TopBar>
        <BackButton type="button" onClick={handleBackToList}>← 목록</BackButton>
        <Title>{challenge.title}</Title>
        <AnomalyBadge log={integrityLog} />
        {submitError && <ErrorText title={submitError}>{submitError}</ErrorText>}
        {!isStatementOpen && (
          <Button variant="ghost" onClick={() => setIsStatementOpen(true)}>
            요구사항 열기
          </Button>
        )}
        {currentUser && (
          <SubmitterTag title="로그인한 사용자 이름으로 제출됩니다">
            제출자 <strong>{currentUser.name}</strong>
          </SubmitterTag>
        )}
        <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </TopBar>

      <Body>
        <StatementColumn $isOpen={isStatementOpen}>
          <ChallengeStatementPanel
            title={challenge.title}
            statement={challenge.statement}
            isOpen={isStatementOpen}
            onToggle={() => setIsStatementOpen((open) => !open)}
          />
        </StatementColumn>

        <AiColumn>
          <AiChatPanel
            aiPolicy={challenge.aiPolicy}
            questionsUsed={questionsUsed}
            tokensUsed={tokensUsed}
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
              onCreateFile={workspace.createFile}
              onDeletePath={workspace.deletePath}
              onRenamePath={workspace.renamePath}
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
              mlConfig={
                challenge.kind === 'ml' && challenge.ml
                  ? {
                      metric: challenge.ml.metric,
                      passThreshold: challenge.ml.passThreshold,
                    }
                  : null
              }
              evalResult={workspace.evalResult}
              isRunningEval={workspace.isRunningEval}
              evalErrorMessage={workspace.evalErrorMessage}
              onRunEvaluation={() => void workspace.runEvaluation()}
              consoleEntries={workspace.consoleEntries}
              onClearConsole={workspace.clearConsole}
              apiConsole={workspace.apiConsole}
              onSendApiRequest={workspace.sendApiRequest}
              apiLogs={workspace.apiLogs}
              onClearApiLogs={workspace.clearApiLogs}
              dbState={workspace.dbState}
              apiData={workspace.apiData}
              isApiDataLoading={workspace.isApiDataLoading}
              onRefreshApiData={() => void workspace.refreshApiData()}
              onResetData={workspace.resetData}
            />
          </PreviewArea>
        </WorkspaceColumn>
      </Body>

      {isProcessingSubmit && (
        <ProgressOverlay role="status" aria-live="polite">
          <ProgressCard>
            <Spinner aria-hidden />
            <ProgressStage>{progressStageLabel}</ProgressStage>
            <ProgressElapsed>{elapsedSeconds}초 경과</ProgressElapsed>
            <ProgressHint>
              AI 정성 채점은 보통 10~30초 정도 걸립니다. 창을 닫지 말고 잠시
              기다려 주세요.
            </ProgressHint>
          </ProgressCard>
        </ProgressOverlay>
      )}

      {gradingResult && (
        <ChallengeGradingResultPanel
          result={gradingResult}
          // 루브릭(criteria·weights)은 채점 기준이라 학생 DTO(StudentChallenge)엔 없지만,
          // 서버가 채점 결과에 함께 담아주므로(rubricCriteria·weights) 그대로 사용해
          // 정확한 점수 분해·항목 라벨을 보여준다. 구버전 결과만 폴백한다.
          criteria={gradingResult.rubricCriteria ?? []}
          weights={gradingResult.weights ?? FALLBACK_RESULT_WEIGHTS}
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
  gap: ${({ theme }) => theme.spacing.sm};
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  flex-shrink: 0;
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

// 제출자 표시 — 로그인 사용자 이름으로 제출됨을 알리는 읽기 전용 라벨(제출 버튼 옆).
const SubmitterTag = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;

  strong {
    color: ${({ theme }) => theme.colors.text};
    font-weight: ${({ theme }) => theme.font.weightBold};
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
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StatementColumn = styled.div<{ $isOpen: boolean }>`
  min-height: 0;
  display: flex;
  ${({ $isOpen }) =>
    $isOpen
      ? css`
          width: 320px;
          flex-shrink: 0;
        `
      : css`
          flex: 0 0 44px;
        `}
`;

// AI 채팅은 가운데 주역.
const AiColumn = styled.div`
  min-height: 0;
  display: flex;
  flex: 1;
  min-width: 340px;
`;

const WorkspaceColumn = styled.div`
  flex: 1.4;
  min-width: 460px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const EditorArea = styled.div`
  flex: 1.2;
  min-height: 0;
`;

const PreviewArea = styled.div`
  flex: 1;
  min-height: 0;
`;

// ── 채점 진행 오버레이 ──────────────────────────────────────────────────────
// 제출~채점 응답까지 화면 전체를 덮어 "동작 중"임을 명확히 알린다. 단발 LLM
// 호출이라 결정형 진척 바는 불가능 → 회전 스피너 + 단계 라벨 + 경과 시간(초)으로
// 정직한 indeterminate 피드백을 준다.

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const ProgressOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 10, 16, 0.66);
`;

const ProgressCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const ProgressStage = styled.span`
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const ProgressElapsed = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  font-variant-numeric: tabular-nums;
`;

const ProgressHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textMuted};
`;
