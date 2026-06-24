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
import styled, { css, type DefaultTheme } from 'styled-components';
import type {
  ApiConsoleConfig,
  ApiConsoleRequest,
  ApiConsoleResponse,
  AutoTestResult,
} from '@/shared/core/types';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { Badge, type BadgeTone } from '@/shared/components/ui/Badge';
import { ApiConsole } from '@/features/solve/components/ApiConsole';
import type {
  BrowserConsoleEntry,
  BrowserConsoleLevel,
  WorkspacePhase,
} from '@/features/solve/useWorkspace';

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

/** 부팅 시퀀스 단계 정의 — 프로그레스 표시용 */
const BOOT_STEPS: { phase: WorkspacePhase; label: string; estimate?: string }[] = [
  { phase: 'booting', label: 'WebContainer 부팅', estimate: '~2초' },
  { phase: 'mounting', label: '파일 mount', estimate: '~1초' },
  { phase: 'installing', label: 'npm install', estimate: '~15초' },
  { phase: 'starting', label: 'dev 서버 시작', estimate: '~3초' },
];

/** 부팅 시퀀스에서 각 단계의 순서 인덱스 (진행률 계산용) */
const PHASE_ORDER: Partial<Record<WorkspacePhase, number>> = {
  booting: 0,
  mounting: 1,
  installing: 2,
  starting: 3,
  ready: 4,
};

type StepState = 'done' | 'active' | 'pending';

/** 현재 phase에 따라 특정 step이 완료/진행중/대기 중 어느 상태인지 반환 */
function getStepState(currentPhase: WorkspacePhase, stepPhase: WorkspacePhase): StepState {
  const current = PHASE_ORDER[currentPhase] ?? -1;
  const step = PHASE_ORDER[stepPhase] ?? -1;
  if (step < current) return 'done';
  if (step === current) return 'active';
  return 'pending';
}

/** 현재 phase에 따른 전체 진행률(0~100%) */
function getProgressPercent(phase: WorkspacePhase): number {
  const order = PHASE_ORDER[phase];
  if (order === undefined) return 0;
  // 4단계(0~3) + ready(4) → 0, 25, 50, 75, 100
  return Math.min(Math.round((order / 4) * 100), 100);
}

// ── Types ─────────────────────────────────────────────────────────────────

type WorkspaceTab = 'preview' | 'api' | 'console' | 'browser' | 'test';

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

  // ── 브라우저 콘솔 (미리보기 앱) ──
  /** 미리보기 앱이 출력한 console.* / 런타임 에러 항목. */
  consoleEntries: BrowserConsoleEntry[];
  /** 브라우저 콘솔 비우기 콜백. */
  onClearConsole: () => void;

  // ── 백엔드 API 요청 콘솔 ──
  /** API 콘솔 설정(백엔드가 있는 워크스페이스에만). null이면 콘솔 탭을 숨긴다. */
  apiConsole?: ApiConsoleConfig | null;
  /** API 요청 전송 콜백(컨테이너 안에서 실행). apiConsole이 있을 때만 사용한다. */
  onSendApiRequest?: (request: ApiConsoleRequest) => Promise<ApiConsoleResponse>;
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
  consoleEntries,
  onClearConsole,
  apiConsole,
  onSendApiRequest,
}: WorkspacePanelProps) {
  // 백엔드 단독(프론트 미리보기 없음)이면 콘솔을 주 탭으로 연다(미리보기는 raw JSON뿐).
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    apiConsole?.isPrimaryView ? 'api' : 'preview',
  );
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const browserEndRef = useRef<HTMLDivElement>(null);

  // 새 로그가 들어오면 콘솔을 맨 아래로 스크롤한다.
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ block: 'end' });
  }, [logs]);

  // 새 브라우저 콘솔 항목이 들어오면 맨 아래로 스크롤한다.
  useEffect(() => {
    browserEndRef.current?.scrollIntoView({ block: 'end' });
  }, [consoleEntries]);

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
          {apiConsole && onSendApiRequest && (
            <Tab $active={activeTab === 'api'} onClick={() => setActiveTab('api')}>
              API 콘솔
            </Tab>
          )}
          <Tab $active={activeTab === 'console'} onClick={() => setActiveTab('console')}>
            콘솔
          </Tab>
          <Tab $active={activeTab === 'browser'} onClick={() => setActiveTab('browser')}>
            브라우저
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
                  <ProgressSteps>
                    {BOOT_STEPS.map((step) => {
                      const stepState = getStepState(phase, step.phase);
                      return (
                        <Step key={step.phase} $state={stepState}>
                          <StepIndicator $state={stepState}>
                            {stepState === 'done' ? '✓' : stepState === 'active' ? <StepSpinner /> : <StepDot />}
                          </StepIndicator>
                          <StepLabel $state={stepState}>{step.label}</StepLabel>
                          {stepState === 'active' && step.estimate && (
                            <StepEstimate>{step.estimate}</StepEstimate>
                          )}
                        </Step>
                      );
                    })}
                  </ProgressSteps>
                  <ProgressBarTrack>
                    <ProgressBarFill $percent={getProgressPercent(phase)} />
                  </ProgressBarTrack>
                  <StatusHint>처음 부팅과 의존성 설치에는 시간이 걸립니다.</StatusHint>
                </>
              )}
            </StatusOverlay>
          ))}

        {activeTab === 'api' && apiConsole && onSendApiRequest && (
          <ApiConsole
            config={apiConsole}
            isReady={phase === 'ready'}
            onSend={onSendApiRequest}
          />
        )}

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

        {activeTab === 'browser' && (
          <BrowserView>
            <BrowserToolbar>
              <Button variant="ghost" onClick={onClearConsole} disabled={consoleEntries.length === 0}>
                지우기
              </Button>
              <BrowserHint>미리보기 앱의 console 출력과 런타임 에러가 표시됩니다.</BrowserHint>
            </BrowserToolbar>
            <BrowserLog>
              {consoleEntries.length === 0 ? (
                <ConsoleEmpty>아직 콘솔 출력이 없습니다.</ConsoleEmpty>
              ) : (
                consoleEntries.map((entry, index) => (
                  <ConsoleLine key={`${entry.timestamp}-${index}`} $level={entry.level}>
                    <ConsoleLevelTag $level={entry.level}>{entry.level}</ConsoleLevelTag>
                    <ConsoleMessage>{entry.message}</ConsoleMessage>
                  </ConsoleLine>
                ))
              )}
              <div ref={browserEndRef} />
            </BrowserLog>
          </BrowserView>
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

// ── 브라우저 콘솔 탭 ─────────────────────────────────────────────────────────

/** 레벨별 강조 색 — 레벨 태그/좌측 보더에 공통으로 쓴다. */
function levelColor(theme: DefaultTheme, level: BrowserConsoleLevel): string {
  if (level === 'error') return theme.colors.danger;
  if (level === 'warn') return theme.colors.warning;
  if (level === 'info') return theme.colors.primary;
  if (level === 'debug') return theme.colors.textMuted;
  return theme.colors.text;
}

const BrowserView = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const BrowserToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const BrowserHint = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const BrowserLog = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: ${({ theme }) => theme.colors.codeBg};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.5;
  padding: ${({ theme }) => theme.spacing.sm} 0;
`;

const ConsoleLine = styled.div<{ $level: BrowserConsoleLevel }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 2px ${({ theme }) => theme.spacing.md};
  border-left: 2px solid ${({ theme, $level }) => levelColor(theme, $level)};
  background: ${({ theme, $level }) =>
    $level === 'error' || $level === 'warn'
      ? `${levelColor(theme, $level)}14`
      : 'transparent'};
`;

const ConsoleLevelTag = styled.span<{ $level: BrowserConsoleLevel }>`
  flex-shrink: 0;
  width: 44px;
  text-transform: uppercase;
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme, $level }) => levelColor(theme, $level)};
`;

const ConsoleMessage = styled.span`
  flex: 1;
  min-width: 0;
  color: ${({ theme }) => theme.colors.text};
  white-space: pre-wrap;
  word-break: break-word;
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

// ── 프로그레스 스텝 ─────────────────────────────────────────────────────────

const ProgressSteps = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  max-width: 320px;
`;

const Step = styled.div<{ $state: StepState }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  opacity: ${({ $state }) => ($state === 'pending' ? 0.4 : 1)};
  transition: opacity 0.3s ease;
`;

const StepIndicator = styled.div<{ $state: StepState }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
  color: ${({ theme, $state }) =>
    $state === 'done' ? theme.colors.background : theme.colors.textMuted};
  background: ${({ theme, $state }) =>
    $state === 'done'
      ? theme.colors.success
      : $state === 'active'
        ? 'transparent'
        : theme.colors.surfaceAlt};
  border: 2px solid
    ${({ theme, $state }) =>
      $state === 'done'
        ? theme.colors.success
        : $state === 'active'
          ? theme.colors.primary
          : theme.colors.border};
  transition: all 0.3s ease;
`;

const StepSpinner = styled.div`
  width: 10px;
  height: 10px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const StepDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.border};
`;

const StepLabel = styled.span<{ $state: StepState }>`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ $state }) => ($state === 'active' ? 600 : 400)};
  color: ${({ theme, $state }) =>
    $state === 'active' ? theme.colors.text : theme.colors.textMuted};
`;

const StepEstimate = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-left: auto;
`;

const ProgressBarTrack = styled.div`
  width: 100%;
  max-width: 320px;
  height: 4px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border-radius: 2px;
  overflow: hidden;
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const ProgressBarFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 2px;
  transition: width 0.5s ease;
`;
