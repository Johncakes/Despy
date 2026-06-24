/**
 * SolveView.tsx — 학생 풀이 화면 오케스트레이터
 *
 * 좌(문제 지문) · 중(AI 도우미, 토글) · 우(코드 에디터 + 채점 결과) 3열 레이아웃을
 * 구성한다. "바이브 코딩 실력"을 시험하는 목적상 AI 채팅을 가운데 주역으로 두고,
 * AI가 작성한 코드는 우측 에디터로 흘러간다(직접 편집). 문제별 풀이 세션
 * (코드/언어/AI 사용량)은 solveSessionStore에 보관하고, 채점은
 * useGradeSubmission(/api/judge)으로 수행한다.
 *
 * 사용처: app/solve/[problemId]/page.tsx
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import styled, { css } from 'styled-components';
import type { GradingRequest, Problem, TestCase } from '@/shared/core/types';
import {
  SUPPORTED_LANGUAGES,
  findLanguageById,
} from '@/shared/core/constants/languages';
import { useSolveSessionStore } from '@/shared/core/stores/solveSessionStore';
import { useGradeSubmission } from '@/shared/core/queries/judgeQueries';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { ProblemPanel } from '@/features/solve/components/ProblemPanel';
import { CodeEditorPanel } from '@/features/solve/components/CodeEditorPanel';
import { GradingResultPanel } from '@/features/solve/components/GradingResultPanel';
import { AiChatPanel } from '@/features/solve/components/AiChatPanel';

// ── Component ─────────────────────────────────────────────────────────────

export function SolveView({ problem }: { problem: Problem }) {
  const allowedLanguages = SUPPORTED_LANGUAGES.filter((lang) =>
    problem.allowedLanguageIds.includes(lang.id),
  );
  const languages = allowedLanguages.length > 0 ? allowedLanguages : SUPPORTED_LANGUAGES;
  const fallbackLanguage = languages[0];

  const session = useSolveSessionStore((state) => state.sessions[problem.id]);
  const ensureSession = useSolveSessionStore((state) => state.ensureSession);
  const setCode = useSolveSessionStore((state) => state.setCode);
  const setLanguage = useSolveSessionStore((state) => state.setLanguage);
  const recordAiTurn = useSolveSessionStore((state) => state.recordAiTurn);

  const [isAiOpen, setIsAiOpen] = useState(true);
  const gradeMutation = useGradeSubmission();

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

  const handleAiCodeStream = useCallback(
    (code: string) => {
      setCode(problem.id, code);
    },
    [problem.id, setCode],
  );

  const handleAiCodeStreamEnd = useCallback(() => {
    setIsAiWritingCode(false);
  }, []);

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

  const currentLanguage = findLanguageById(session.languageId) ?? fallbackLanguage;

  const handleLanguageChange = (languageId: string) => {
    const language = findLanguageById(languageId);
    if (!language) return;
    // 언어를 바꾸면 해당 언어 기본 보일러플레이트로 교체한다.
    setLanguage(problem.id, languageId, language.defaultCode);
  };

  const runGrade = (testCases: TestCase[]) => {
    const request: GradingRequest = {
      problemId: problem.id,
      languageId: session.languageId,
      judge0LanguageId: currentLanguage.judge0Id,
      sourceCode: session.code,
      timeLimitSec: problem.timeLimitSec,
      memoryLimitMb: problem.memoryLimitMb,
      testCases,
    };
    gradeMutation.mutate(request);
  };

  return (
    <Wrapper>
      <TopBar>
        <BackLink href="/">← 목록</BackLink>
        <Title>{problem.title}</Title>
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
            problem={problem}
            questionsUsed={session.questionsUsed}
            tokensUsed={session.tokensUsed}
            isOpen={isAiOpen}
            onToggle={() => setIsAiOpen((open) => !open)}
            onTurnComplete={(totalTokens) => recordAiTurn(problem.id, totalTokens)}
            isDirectEditEnabled={isDirectEditEnabled}
            onToggleDirectEdit={() => setIsDirectEditEnabled((enabled) => !enabled)}
            onAiCodeStreamStart={handleAiCodeStreamStart}
            onAiCodeStream={handleAiCodeStream}
            onAiCodeStreamEnd={handleAiCodeStreamEnd}
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
                runGrade(problem.testCases.filter((testCase) => testCase.isPublic))
              }
              onSubmit={() => runGrade(problem.testCases)}
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
  gap: ${({ theme }) => theme.spacing.md};
`;

const EditorArea = styled.div`
  flex: 2;
  min-height: 0;
`;

const ResultArea = styled.div`
  flex: 1;
  min-height: 0;
`;
