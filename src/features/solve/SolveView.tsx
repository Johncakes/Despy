/**
 * SolveView.tsx — 학생 풀이 화면 오케스트레이터
 *
 * 좌(문제 지문) · 중(AI 도우미, 토글) · 우(코드 에디터 + 채점 결과) 3열 레이아웃을
 * 구성한다. "바이브 코딩 실력"을 시험하는 목적상 AI 채팅을 가운데 주역으로 두고,
 * AI가 작성한 코드는 우측 에디터로 흘러간다(직접 편집). 문제별 풀이 세션
 * (코드/언어/AI 사용량)은 solveSessionStore에 보관하고, 채점은
 * useGradeAlgorithm(/api/grade/algorithm)으로 AI 정성 채점한다.
 *
 * 사용처: app/solve/[problemId]/page.tsx
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import styled, { css } from 'styled-components';
import { useProctoringMonitor } from '@/shared/lib/hooks/useProctoringMonitor';
import type { GradingRequest, Problem, TestCase } from '@/shared/core/types';
import {
  SUPPORTED_LANGUAGES,
  findLanguageById,
} from '@/shared/core/constants/languages';
import { useSolveSessionStore } from '@/shared/core/stores/solveSessionStore';
import { useSolveHistoryStore } from '@/shared/core/stores/solveHistoryStore';
import { useGradeAlgorithm } from '@/shared/core/queries/algorithmGradeQueries';
import { applyFileEdit, type FileEdit } from '@/shared/lib/utils/markdownCode';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { ProblemPanel } from '@/features/solve/components/ProblemPanel';
import { CodeEditorPanel } from '@/features/solve/components/CodeEditorPanel';
import { GradingResultPanel } from '@/features/solve/components/GradingResultPanel';
import {
  AiChatPanel,
  type EditApplyReport,
} from '@/features/solve/components/AiChatPanel';

// ── Component ─────────────────────────────────────────────────────────────

export function SolveView({ problem }: { problem: Problem }) {
  const allowedLanguages = SUPPORTED_LANGUAGES.filter((lang) =>
    problem.allowedLanguageIds.includes(lang.id),
  );
  const languages = allowedLanguages.length > 0 ? allowedLanguages : SUPPORTED_LANGUAGES;
  const fallbackLanguage = languages[0];

  const { log: integrityLog, isFullscreen, requestFullscreen } = useProctoringMonitor();
  const totalAnomalies =
    integrityLog.tabSwitchCount + integrityLog.externalPasteCount + integrityLog.fullscreenExitCount;

  const session = useSolveSessionStore((state) => state.sessions[problem.id]);
  const ensureSession = useSolveSessionStore((state) => state.ensureSession);
  const setCode = useSolveSessionStore((state) => state.setCode);
  const setLanguage = useSolveSessionStore((state) => state.setLanguage);
  const recordAiTurn = useSolveSessionStore((state) => state.recordAiTurn);

  const saveResult = useSolveHistoryStore((state) => state.saveResult);

  const [isAiOpen, setIsAiOpen] = useState(true);
  const gradeMutation = useGradeAlgorithm();

  // AI 직접 편집 상태 (실시간 코드 미러링)
  const [isDirectEditEnabled, setIsDirectEditEnabled] = useState(true);
  const [isAiWritingCode, setIsAiWritingCode] = useState(false);
  const [aiCodeSnapshot, setAiCodeSnapshot] = useState<string | null>(null);

  // 콜백 식별자를 안정화(useCallback)해야 AiChatPanel의 미러링 effect가
  // 매 렌더마다 재실행되지 않는다. 스냅샷은 스토어에서 직접 현재 코드를 읽는다.
  const handleAiCodeStreamStart = useCallback(() => {
    const current =
      useSolveSessionStore.getState().sessions[problem.id]?.code ?? '';
    setAiCodeSnapshot(current);
    setIsAiWritingCode(true);
  }, [problem.id]);

  const handleApplyAiEdits = useCallback(
    // 알고리즘 풀이는 단일 코드 버퍼라 path는 무시하고 현재 코드에 순차 적용한다.
    // SEARCH가 정확히 1곳 일치할 때만 교체되고, 미일치는 거부된다(코드 보존).
    (edits: FileEdit[]): EditApplyReport => {
      let content = useSolveSessionStore.getState().sessions[problem.id]?.code ?? '';
      let applied = 0;
      let failed = 0;
      for (const edit of edits) {
        const result = applyFileEdit(content, edit.search, edit.replace);
        if (result.ok) {
          content = result.content;
          applied += 1;
        } else {
          failed += 1;
        }
      }
      if (applied > 0) setCode(problem.id, content);
      return { applied, failed };
    },
    [problem.id, setCode],
  );

  const handleAiCodeStreamEnd = useCallback(() => {
    setIsAiWritingCode(false);
  }, []);

  // 질문에 첨부할 현재 코드 상태 — 전송 시점에 스토어에서 최신 코드를 읽는다.
  const getCodeContext = useCallback(() => {
    const current = useSolveSessionStore.getState().sessions[problem.id];
    if (!current) return '';
    return `현재 코드 (${current.languageId}):\n\`\`\`\n${current.code}\n\`\`\``;
  }, [problem.id]);

  const handleUndoAiCode = () => {
    if (aiCodeSnapshot === null) return;
    setCode(problem.id, aiCodeSnapshot);
    setAiCodeSnapshot(null);
  };

  useEffect(() => {
    ensureSession(problem.id, {
      languageId: fallbackLanguage.id,
      code: fallbackLanguage.defaultCode,
      questionsUsed: 0,
      tokensUsed: 0,
    });
  }, [problem.id, ensureSession, fallbackLanguage.id, fallbackLanguage.defaultCode]);

  // ensureSession 효과 이전(첫 렌더)에는 세션이 없을 수 있다.
  if (!session) return null;

  const handleLanguageChange = (languageId: string) => {
    const language = findLanguageById(languageId);
    if (!language) return;
    // 언어를 바꾸면 해당 언어 기본 보일러플레이트로 교체한다.
    setLanguage(problem.id, languageId, language.defaultCode);
  };

  // 채점을 실행한다. isSubmission=true(제출, 전체 케이스)일 때만 결과를 마이페이지
  // 이력에 영속한다 — "예제 실행"(공개 케이스만)은 자기 점검이라, 전체 제출과 다른
  // (더 적은) 케이스 집합으로 산출된 점수가 "마지막 채점 결과"를 덮어쓰지 않게 한다.
  const runGrade = (testCases: TestCase[], isSubmission: boolean) => {
    const request: GradingRequest = {
      problemId: problem.id,
      languageId: session.languageId,
      statement: problem.statement,
      sourceCode: session.code,
      testCases,
      model: problem.aiPolicy.model,
      systemPrompt: problem.aiPolicy.systemPrompt,
    };
    gradeMutation.mutate(
      request,
      isSubmission
        ? { onSuccess: (result) => saveResult(problem.id, result) }
        : undefined,
    );
  };

  return (
    <Wrapper>
      {!isFullscreen && (
        <FullscreenBanner>
          시험 모드를 위해 전체화면을 권장합니다.
          <FullscreenButton type="button" onClick={requestFullscreen}>
            전체화면 시작
          </FullscreenButton>
        </FullscreenBanner>
      )}
      <TopBar>
        <BackLink href="/">← 목록</BackLink>
        <Title>{problem.title}</Title>
        {totalAnomalies > 0 && (
          <AnomalyBadge
            title={`탭 이탈 ${integrityLog.tabSwitchCount}회 · 외부 붙여넣기 ${integrityLog.externalPasteCount}회 · 전체화면 이탈 ${integrityLog.fullscreenExitCount}회`}
          >
            ⚠ {totalAnomalies}
          </AnomalyBadge>
        )}
        {!isAiOpen && (
          <Button variant="ghost" onClick={() => setIsAiOpen(true)}>
            AI 도우미 열기
          </Button>
        )}
      </TopBar>

      <Body>
        <ProblemColumn>
          <ProblemPanel problem={problem} />
        </ProblemColumn>

        <AiColumn $isOpen={isAiOpen}>
          <AiChatPanel
            aiPolicy={problem.aiPolicy}
            questionsUsed={session.questionsUsed}
            tokensUsed={session.tokensUsed}
            isOpen={isAiOpen}
            onToggle={() => setIsAiOpen((open) => !open)}
            onTurnComplete={(totalTokens) => recordAiTurn(problem.id, totalTokens)}
            isDirectEditEnabled={isDirectEditEnabled}
            onToggleDirectEdit={() => setIsDirectEditEnabled((enabled) => !enabled)}
            onAiCodeStreamStart={handleAiCodeStreamStart}
            onApplyAiEdits={handleApplyAiEdits}
            onAiCodeStreamEnd={handleAiCodeStreamEnd}
            getCodeContext={getCodeContext}
          />
        </AiColumn>

        <CodeColumn>
          <EditorArea>
            <CodeEditorPanel
              allowedLanguages={languages}
              languageId={session.languageId}
              code={session.code}
              onCodeChange={(code) => setCode(problem.id, code)}
              onLanguageChange={handleLanguageChange}
              onRunExamples={() =>
                runGrade(
                  problem.testCases.filter((testCase) => testCase.isPublic),
                  false,
                )
              }
              onSubmit={() => runGrade(problem.testCases, true)}
              isGrading={gradeMutation.isPending}
              isReadOnly={isAiWritingCode}
              canUndoAiCode={aiCodeSnapshot !== null}
              onUndoAiCode={handleUndoAiCode}
            />
          </EditorArea>
          <ResultArea>
            <Panel title="채점 결과">
              <GradingResultPanel
                result={gradeMutation.data ?? null}
                isGrading={gradeMutation.isPending}
                errorMessage={gradeMutation.error?.message ?? null}
              />
            </Panel>
          </ResultArea>
        </CodeColumn>
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
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ProblemColumn = styled.div`
  width: 320px;
  min-height: 0;
  flex-shrink: 0;
`;

// AI 채팅은 가운데 주역 — 열려 있으면 넓게 차지하고, 접으면 얇은 바(44px)로 축소.
const AiColumn = styled.div<{ $isOpen: boolean }>`
  min-height: 0;
  display: flex;
  ${({ $isOpen }) =>
    $isOpen
      ? css`
          flex: 1;
          min-width: 360px;
        `
      : css`
          flex: 0 0 44px;
        `}
`;

const CodeColumn = styled.div`
  flex: 1.3;
  min-width: 420px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const EditorArea = styled.div`
  flex: 2;
  min-height: 0;
`;

const ResultArea = styled.div`
  flex: 1;
  min-height: 0;
`;

const FullscreenBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FullscreenButton = styled.button`
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-family: inherit;
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
`;

const AnomalyBadge = styled.span`
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.warning};
  border: 1px solid ${({ theme }) => theme.colors.warning};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: default;
  white-space: nowrap;
`;
