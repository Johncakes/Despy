/**
 * WorkspacePanel.tsx — WebContainer 워크스페이스 패널 (미리보기 + 콘솔)
 *
 * useWorkspace가 노출하는 진행 단계(phase)·로그·미리보기 URL을 받아 두 개의 탭
 * (미리보기 iframe / 콘솔 로그)으로 보여주는 표시 전용 컴포넌트다. 상태를 직접
 * 만들지 않고 props/콜백으로만 통신한다(제어 컴포넌트). 준비 전에는 진행 상태
 * 오버레이를, 준비 후에는 dev 서버 iframe을 보여준다.
 *
 * 사용처: features/solve/WorkspacePlaygroundView (P0 PoC), 이후 SolveView
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import type { AutoTestResult } from '@/shared/core/types';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { Badge, type BadgeTone } from '@/shared/components/ui/Badge';
import type { WorkspacePhase } from '@/features/solve/useWorkspace';

// ── Constants ─────────────────────────────────────────────────────────────

/** 진행 단계 → 배지 표시(레이블·색) */
const PHASE_META: Record<WorkspacePhase, { label: string; tone: BadgeTone }> = {
  idle: { label: '대기', tone: 'neutral' },
  booting: { label: '부팅 중…', tone: 'info' },
  mounting: { label: '파일 mount 중…', tone: 'info' },
  installing: { label: 'npm install 중…', tone: 'info' },
  starting: { label: 'dev 서버 시작 중…', tone: 'info' },
  ready: { label: '준비 완료', tone: 'success' },
  error: { label: '오류', tone: 'danger' },
};

// ── Types ─────────────────────────────────────────────────────────────────

type WorkspaceTab = 'preview' | 'console' | 'test';

interface WorkspacePanelProps {
  phase: WorkspacePhase;
  logs: string[];
  previewUrl: string | null;
  errorMessage: string | null;
  onRetry: () => void;

  // ── 자동 테스트 (P2) ──
  /** 마지막 테스트 결과(미실행이면 null) */
  testResult: AutoTestResult | null;
  /** 테스트 실행 중 여부 */
  isRunningTests: boolean;
  /** 테스트 실행 실패 메시지(정상 실행이면 null) */
  testErrorMessage: string | null;
  /** '테스트 실행' 요청 콜백 */
  onRunTests: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function WorkspacePanel({
  phase,
  logs,
  previewUrl,
  errorMessage,
  onRetry,
  testResult,
  isRunningTests,
  testErrorMessage,
  onRunTests,
}: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('preview');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // 새 로그가 들어오면 콘솔을 맨 아래로 스크롤한다.
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ block: 'end' });
  }, [logs]);

  const meta = PHASE_META[phase];
  // 테스트는 의존성 설치가 끝난 ready 상태에서만 실행 가능.
  const canRunTests = phase === 'ready' && !isRunningTests;

  return (
    <Panel
      title={
        <TitleRow>
          <span>워크스페이스</span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </TitleRow>
      }
      actions={
        <Actions>
          <Tab $active={activeTab === 'preview'} onClick={() => setActiveTab('preview')}>
            미리보기
          </Tab>
          <Tab $active={activeTab === 'console'} onClick={() => setActiveTab('console')}>
            콘솔
          </Tab>
          <Tab $active={activeTab === 'test'} onClick={() => setActiveTab('test')}>
            테스트
          </Tab>
          {phase === 'error' && (
            <Button variant="ghost" onClick={onRetry}>
              다시 시작
            </Button>
          )}
        </Actions>
      }
      isBodyFlush
    >
      <Content>
        {activeTab === 'preview' &&
          (previewUrl ? (
            <PreviewFrame
              title="WebContainer 미리보기"
              src={previewUrl}
              // dev 서버는 별도 출처(webcontainer-api.io)에서 서빙된다.
              allow="cross-origin-isolated"
            />
          ) : (
            <StatusOverlay>
              {phase === 'error' ? (
                <>
                  <StatusTitle $tone="danger">워크스페이스 시작 실패</StatusTitle>
                  <StatusDetail>{errorMessage}</StatusDetail>
                  <StatusHint>콘솔 탭에서 자세한 로그를 확인하세요.</StatusHint>
                </>
              ) : (
                <>
                  <Spinner />
                  <StatusTitle>{meta.label}</StatusTitle>
                  <StatusHint>처음 부팅과 의존성 설치에는 시간이 걸립니다.</StatusHint>
                </>
              )}
            </StatusOverlay>
          ))}

        {activeTab === 'console' && (
          <Console>
            {logs.length === 0 ? (
              <ConsoleEmpty>아직 출력이 없습니다.</ConsoleEmpty>
            ) : (
              logs.join('')
            )}
            <div ref={consoleEndRef} />
          </Console>
        )}

        {activeTab === 'test' && (
          <TestView>
            <TestToolbar>
              <Button onClick={onRunTests} disabled={!canRunTests}>
                {isRunningTests ? '테스트 실행 중…' : '테스트 실행'}
              </Button>
              {testResult && (
                <Badge
                  tone={
                    testResult.passedCount === testResult.totalCount ? 'success' : 'danger'
                  }
                >
                  {testResult.passedCount}/{testResult.totalCount} 통과
                </Badge>
              )}
              {phase !== 'ready' && !isRunningTests && (
                <TestHint>워크스페이스가 준비되면 실행할 수 있습니다.</TestHint>
              )}
            </TestToolbar>

            <TestBody>
              {testErrorMessage ? (
                <TestError>{testErrorMessage}</TestError>
              ) : isRunningTests && !testResult ? (
                <TestCentered>
                  <Spinner />
                  <StatusHint>npm test 실행 중… (최초 실행은 시간이 걸릴 수 있습니다)</StatusHint>
                </TestCentered>
              ) : testResult ? (
                <CaseList>
                  {testResult.cases.map((testCase, index) => (
                    <CaseItem key={`${testCase.name}-${index}`}>
                      <CaseHeader>
                        <CaseStatus $passed={testCase.passed}>
                          {testCase.passed ? '통과' : '실패'}
                        </CaseStatus>
                        <CaseName>{testCase.name}</CaseName>
                      </CaseHeader>
                      {!testCase.passed && testCase.message && (
                        <CaseMessage>{testCase.message}</CaseMessage>
                      )}
                    </CaseItem>
                  ))}
                </CaseList>
              ) : (
                <TestCentered>
                  <StatusHint>‘테스트 실행’을 눌러 자동 테스트를 실행하세요.</StatusHint>
                </TestCentered>
              )}
            </TestBody>
          </TestView>
        )}
      </Content>
    </Panel>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};

  ${({ theme, $active }) =>
    $active &&
    css`
      color: ${theme.colors.text};
      background: ${theme.colors.surface};
      border-color: ${theme.colors.border};
    `}
`;

const Content = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
`;

const PreviewFrame = styled.iframe`
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
`;

const StatusOverlay = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

const StatusTitle = styled.p<{ $tone?: 'danger' }>`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $tone }) =>
    $tone === 'danger' ? theme.colors.danger : theme.colors.text};
`;

const StatusDetail = styled.p`
  margin: 0;
  max-width: 420px;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
  word-break: break-word;
`;

const StatusHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const Console = styled.div`
  height: 100%;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ConsoleEmpty = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
`;

// ── 테스트 탭 ───────────────────────────────────────────────────────────────

const TestView = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const TestToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TestHint = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TestBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.md};
`;

const TestCentered = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  text-align: center;
`;

const TestError = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
  white-space: pre-wrap;
  word-break: break-word;
`;

const CaseList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CaseItem = styled.li`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surface};
`;

const CaseHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CaseStatus = styled.span<{ $passed: boolean }>`
  flex-shrink: 0;
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $passed }) => ($passed ? theme.colors.success : theme.colors.danger)};
  background: ${({ theme, $passed }) =>
    `${$passed ? theme.colors.success : theme.colors.danger}22`};
`;

const CaseName = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;
`;

const CaseMessage = styled.pre`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: ${({ theme }) => theme.spacing.sm};
  max-height: 200px;
  overflow: auto;
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.danger};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeXs};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;
