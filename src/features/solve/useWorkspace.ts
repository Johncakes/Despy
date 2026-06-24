/**
 * useWorkspace.ts — WebContainer 라이프사이클 + 파일 편집을 React로 감싸는 훅
 *
 * shared/lib/webcontainer의 저수준 싱글턴 API를 감싸, 마운트 시 자동으로
 * 부팅→mount→npm install→npm run dev 시퀀스를 진행하고 진행 단계(phase)·콘솔
 * 로그·미리보기 URL·에러를 React 상태로 노출한다. 또한 편집용 파일 버퍼와 활성
 * 파일을 관리하고, 변경을 debounce해 FS로 단방향 동기화한다(→ Vite HMR로 미리보기
 * 자동 갱신). 학생 편집과 AI 미러링이 동일한 writeFile 경로를 공유한다(§3.3).
 *
 * 레이어 규칙상 feature는 WebContainer 런타임을 이 훅을 통해서만 사용한다.
 * WebContainer 인스턴스는 React state가 아니라 shared/lib 싱글턴이 보유하고,
 * StrictMode의 이펙트 2회 실행에 대비해 시퀀스는 ref 가드로 1회만 시작한다.
 *
 * ⚠️ 파일 버퍼 영속(despy-workspace persist)은 실제 과제(ChallengeProblem)가
 *    생기는 단계(P4)에서 도입한다. 현재(P1)는 in-memory 버퍼다.
 *
 * 사용처: features/solve/WorkspacePlaygroundView (P0/P1 PoC), 이후 SolveView 워크스페이스
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AutoTestResult, ProjectFiles } from '@/shared/core/types';
import {
  bootWebContainer,
  mountProjectFiles,
  runCommand,
  startDevServer,
} from '@/shared/lib/webcontainer/runtime';
import { createFileSync, type FileSync } from '@/shared/lib/webcontainer/fileSync';
import { runTests as runTestSuite } from '@/shared/lib/webcontainer/testRunner';
import { logger } from '@/shared/lib/utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────

/** 워크스페이스 준비 진행 단계 */
export type WorkspacePhase =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error';

export interface UseWorkspaceResult {
  // ── 런타임 상태 ──
  phase: WorkspacePhase;
  /** install/dev 프로세스의 출력 로그(콘솔 패널용) */
  logs: string[];
  /** dev 서버 미리보기 URL (준비 전 null) */
  previewUrl: string | null;
  errorMessage: string | null;
  /**
   * 워크스페이스를 처음부터 다시 시작한다.
   * WebContainer는 탭당 1회만 boot 가능하므로 안전하게 페이지를 새로고침한다.
   */
  retry: () => void;

  // ── 파일 편집 ──
  /** 현재 편집 버퍼(경로→내용). FS로 단방향 동기화되는 작업본. */
  files: ProjectFiles;
  /** 현재 에디터에 열려 있는 파일 경로 */
  activePath: string;
  /** 편집 불가(read-only) 경로 목록 */
  lockedPaths: readonly string[];
  /** 에디터에 열 파일을 바꾼다(잠금 파일도 열어 read-only로 볼 수 있음) */
  setActivePath: (path: string) => void;
  /** 파일 내용을 갱신한다(버퍼 + debounce FS 동기화). 잠금 경로는 무시한다. */
  writeFile: (path: string, contents: string) => void;
  /** 해당 경로가 잠겨 있는지 */
  isPathLocked: (path: string) => boolean;

  // ── 자동 테스트 (P2) ──
  /**
   * WebContainer 안에서 `npm test`(Vitest)를 실행하고 결과를 캡처한다.
   * 풀이 중 즉시 피드백용이며 공식 점수가 아니다(§7.2). 결과는 testResult로도 노출된다.
   */
  runTests: () => Promise<AutoTestResult>;
  /** 마지막 테스트 실행 결과(미실행이면 null) */
  testResult: AutoTestResult | null;
  /** 테스트 실행 중 여부 */
  isRunningTests: boolean;
  /** 테스트 실행 실패 메시지(타임아웃·결과 파일 부재 등, 정상 실행이면 null) */
  testErrorMessage: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 초기 활성 파일: src/App.jsx 우선, 없으면 첫 편집 가능 파일, 그것도 없으면 첫 파일 */
function pickDefaultActivePath(
  template: ProjectFiles,
  lockedPaths: readonly string[],
): string {
  const locked = new Set(lockedPaths);
  const keys = Object.keys(template);
  if (keys.includes('src/App.jsx') && !locked.has('src/App.jsx')) return 'src/App.jsx';
  return keys.find((key) => !locked.has(key)) ?? keys[0] ?? '';
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWorkspace(
  template: ProjectFiles,
  lockedPaths: readonly string[] = [],
): UseWorkspaceResult {
  // 시퀀스가 한 번만 시작되도록 가드(StrictMode 이펙트 2회 실행 방지).
  const hasStartedRef = useRef(false);
  // 경로별 debounce FS 동기화기(1회 생성).
  const fileSyncRef = useRef<FileSync | null>(null);
  if (fileSyncRef.current === null) fileSyncRef.current = createFileSync();

  const [phase, setPhase] = useState<WorkspacePhase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [files, setFiles] = useState<ProjectFiles>(template);
  const [activePath, setActivePath] = useState<string>(() =>
    pickDefaultActivePath(template, lockedPaths),
  );

  // 자동 테스트(P2) 상태. 중복 실행은 ref로 가드한다(동시 spawn 방지).
  const [testResult, setTestResult] = useState<AutoTestResult | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);
  const isRunningTestsRef = useRef(false);

  const lockedSet = useMemo(() => new Set(lockedPaths), [lockedPaths]);
  const isPathLocked = useCallback((path: string) => lockedSet.has(path), [lockedSet]);

  const appendLog = useCallback((chunk: string) => {
    setLogs((prev) => [...prev, chunk]);
  }, []);

  const writeFile = useCallback(
    (path: string, contents: string) => {
      if (lockedSet.has(path)) return; // 잠금 파일은 편집 불가
      setFiles((prev) => (prev[path] === contents ? prev : { ...prev, [path]: contents }));
      fileSyncRef.current?.schedule(path, contents);
    },
    [lockedSet],
  );

  const runTests = useCallback(async (): Promise<AutoTestResult> => {
    if (isRunningTestsRef.current) {
      throw new Error('테스트가 이미 실행 중입니다.');
    }
    isRunningTestsRef.current = true;
    setIsRunningTests(true);
    setTestErrorMessage(null);
    appendLog('[despy] npm test 실행 중…\n');

    try {
      // P2 PoC/샘플 과제는 'npm test'(Vitest)로 고정. P4에서 challenge.testCommand로 일반화.
      const result = await runTestSuite('npm', ['test'], appendLog);
      setTestResult(result);
      appendLog(`[despy] 테스트 완료 — ${result.passedCount}/${result.totalCount} 통과\n`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestErrorMessage(message);
      appendLog(`[despy] 테스트 실패: ${message}\n`);
      logger.error('[useWorkspace] 테스트 실행 실패', error);
      throw error;
    } finally {
      isRunningTestsRef.current = false;
      setIsRunningTests(false);
    }
  }, [appendLog]);

  const start = useCallback(async () => {
    try {
      setPhase('booting');
      appendLog('[despy] WebContainer 부팅 중…\n');
      await bootWebContainer();

      setPhase('mounting');
      appendLog('[despy] 프로젝트 파일 mount 중…\n');
      await mountProjectFiles(template);

      setPhase('installing');
      appendLog('[despy] npm install 실행 중… (최초 1회는 수십 초 걸릴 수 있습니다)\n');
      const installExitCode = await runCommand('npm', ['install'], appendLog);
      if (installExitCode !== 0) {
        throw new Error(`npm install 실패 (exit ${installExitCode}).`);
      }

      setPhase('starting');
      appendLog('[despy] npm run dev 시작…\n');
      const { url } = await startDevServer('npm', ['run', 'dev'], appendLog);

      setPreviewUrl(url);
      setPhase('ready');
      appendLog(`[despy] 미리보기 준비 완료 → ${url}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setPhase('error');
      logger.error('[useWorkspace] 워크스페이스 시작 실패', error);
    }
  }, [template, appendLog]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void start();
  }, [start]);

  // 언마운트 시 대기 중인 FS 쓰기 정리.
  useEffect(() => {
    const fileSync = fileSyncRef.current;
    return () => fileSync?.cancel();
  }, []);

  const retry = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  return {
    phase,
    logs,
    previewUrl,
    errorMessage,
    retry,
    files,
    activePath,
    lockedPaths,
    setActivePath,
    writeFile,
    isPathLocked,
    runTests,
    testResult,
    isRunningTests,
    testErrorMessage,
  };
}
