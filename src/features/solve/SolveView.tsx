/**
 * SolveView.tsx — 학생 풀이 화면 오케스트레이터
 *
 * 좌(문제 지문) · 중(코드 에디터 + 채점 결과) · 우(AI 도우미, 토글) 3열 레이아웃을
 * 구성한다. 문제별 풀이 세션(코드/언어/AI 사용량)은 solveSessionStore에 보관하고,
 * 채점은 useGradeSubmission(/api/judge)으로 수행한다.
 *
 * 사용처: app/solve/[problemId]/page.tsx
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
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

        <EditorColumn>
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
        </EditorColumn>

        <AiColumn>
          <AiChatPanel
            problem={problem}
            questionsUsed={session.questionsUsed}
            tokensUsed={session.tokensUsed}
            isOpen={isAiOpen}
            onToggle={() => setIsAiOpen((open) => !open)}
            onTurnComplete={(totalTokens) => recordAiTurn(problem.id, totalTokens)}
          />
        </AiColumn>
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
  width: 360px;
  min-height: 0;
  flex-shrink: 0;
`;

const EditorColumn = styled.div`
  flex: 1;
  min-width: 0;
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

const AiColumn = styled.div`
  min-height: 0;
  flex-shrink: 0;
`;
