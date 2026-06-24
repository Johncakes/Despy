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
 * 파일 버퍼·AI 사용량 영속(despy-workspace, P4): challengeId가 주어지면 편집 델타
 *    (템플릿 대비 변경분)와 AI 사용량(질문/토큰)을 IndexedDB(workspaceStore)에
 *    저장·복원한다. IndexedDB rehydrate는 비동기라 복원이 끝난 뒤(hasHydrated)에
 *    mount(boot)를 시작해 저장된 편집분이 미리보기에 반영되게 한다(§9.1).
 *    challengeId가 없으면(PoC) in-memory로만 동작한다.
 *
 * 사용처: features/solve/ChallengeSolveView(과제 풀이·영속), WorkspacePlaygroundView(PoC·in-memory)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AutoTestResult, ProjectFiles } from '@/shared/core/types';
import {
  getWorkspaceSession,
  useWorkspaceStore,
} from '@/shared/core/stores/workspaceStore';
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

  // ── AI 사용량 (영속, P4) ──
  /** 지금까지 보낸 AI 질문 횟수(challengeId 없으면 0) */
  questionsUsed: number;
  /** 지금까지 누적된 AI 토큰(입력+출력, challengeId 없으면 0) */
  tokensUsed: number;
  /** AI 응답 1턴을 기록(질문 +1, 토큰 누적). challengeId 없으면 no-op. */
  recordAiTurn: (totalTokens: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * 편집 → 파일 델타 영속(IndexedDB) debounce(ms). FS 동기화(250ms)보다 약간 길게 잡아
 * 연속 타이핑 중 IndexedDB 쓰기 폭주를 줄인다(편집 종료 후 한 번에 저장).
 */
const WORKSPACE_PERSIST_DEBOUNCE_MS = 400;

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

/**
 * 영속할 파일 델타를 계산한다 — 잠금 파일을 제외하고, 템플릿과 내용이 다른(또는 새로
 * 추가된) 편집 가능 파일만 남긴다. 전체 트리 대신 변경분만 저장해 IndexedDB 용량과
 * 복원 비용을 줄인다(§9.1). 복원 시 { ...template, ...delta }로 병합한다.
 */
function computeFileDelta(
  files: ProjectFiles,
  template: ProjectFiles,
  lockedPaths: readonly string[],
): ProjectFiles {
  const locked = new Set(lockedPaths);
  const delta: ProjectFiles = {};
  for (const [path, contents] of Object.entries(files)) {
    if (locked.has(path)) continue;
    if (contents !== template[path]) delta[path] = contents;
  }
  return delta;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWorkspace(
  template: ProjectFiles,
  lockedPaths: readonly string[] = [],
  challengeId?: string,
): UseWorkspaceResult {
  // 시퀀스가 한 번만 시작되도록 가드(StrictMode 이펙트 2회 실행 방지).
  const hasStartedRef = useRef(false);
  // 경로별 debounce FS 동기화기(1회 생성).
  const fileSyncRef = useRef<FileSync | null>(null);
  if (fileSyncRef.current === null) fileSyncRef.current = createFileSync();
  // 파일 델타 영속(IndexedDB) debounce 타이머. 최신 파일 버퍼는 ref로 읽는다.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesRef = useRef<ProjectFiles>(template);

  // 영속 상태 구독: IndexedDB 복원 완료 여부 + 과제별 AI 사용량(없으면 0).
  // 파일 델타는 구독하지 않는다(boot 시 동기 조회) — 편집 중 불필요한 재렌더 방지.
  const hasHydrated = useWorkspaceStore((state) => state.hasHydrated);
  const questionsUsed = useWorkspaceStore((state) =>
    challengeId ? (state.sessions[challengeId]?.questionsUsed ?? 0) : 0,
  );
  const tokensUsed = useWorkspaceStore((state) =>
    challengeId ? (state.sessions[challengeId]?.tokensUsed ?? 0) : 0,
  );

  const [phase, setPhase] = useState<WorkspacePhase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [files, setFiles] = useState<ProjectFiles>(template);
  const [activePath, setActivePathState] = useState<string>(() =>
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

  // 현재 파일 버퍼를 ref로 미러링해, debounce 후 영속 시점에 최신 델타를 계산한다.
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // 편집 델타를 debounce 후 IndexedDB(workspaceStore)에 저장한다. challengeId가
  // 없으면(PoC) 영속하지 않는다. 즉시 호출(flush=true)은 언마운트 시 사용한다.
  const persistFileDelta = useCallback(() => {
    if (!challengeId) return;
    const delta = computeFileDelta(filesRef.current, template, lockedPaths);
    useWorkspaceStore.getState().saveFileDelta(challengeId, delta);
  }, [challengeId, template, lockedPaths]);

  const scheduleFileDeltaPersist = useCallback(() => {
    if (!challengeId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistFileDelta();
    }, WORKSPACE_PERSIST_DEBOUNCE_MS);
  }, [challengeId, persistFileDelta]);

  const writeFile = useCallback(
    (path: string, contents: string) => {
      if (lockedSet.has(path)) return; // 잠금 파일은 편집 불가
      setFiles((prev) => (prev[path] === contents ? prev : { ...prev, [path]: contents }));
      fileSyncRef.current?.schedule(path, contents);
      scheduleFileDeltaPersist();
    },
    [lockedSet, scheduleFileDeltaPersist],
  );

  // 활성 파일 전환을 영속한다(새로고침 시 마지막 파일 복원). challengeId 없으면 표시용.
  const setActivePath = useCallback(
    (path: string) => {
      setActivePathState(path);
      if (challengeId) useWorkspaceStore.getState().saveActivePath(challengeId, path);
    },
    [challengeId],
  );

  // AI 응답 1턴을 사용량에 기록(영속). challengeId 없으면(PoC) no-op.
  const recordAiTurn = useCallback(
    (totalTokens: number) => {
      if (challengeId) useWorkspaceStore.getState().recordAiTurn(challengeId, totalTokens);
    },
    [challengeId],
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
      // 영속된 세션이 있으면 템플릿 대비 변경분을 병합해 복원한다(§9.1). 복원된 파일은
      // mount 대상이자 에디터 버퍼가 되어 미리보기가 저장된 작업 상태를 반영한다.
      const restored = challengeId ? getWorkspaceSession(challengeId) : undefined;
      const restoredDelta = restored?.fileDelta ?? {};
      const initialFiles =
        Object.keys(restoredDelta).length > 0
          ? { ...template, ...restoredDelta }
          : template;
      if (initialFiles !== template) {
        setFiles(initialFiles);
        filesRef.current = initialFiles;
      }
      // 복원된 활성 파일이 현재 파일트리에 존재하면 그 파일을 연다(없으면 기본 유지).
      if (restored?.activePath && initialFiles[restored.activePath] !== undefined) {
        setActivePathState(restored.activePath);
      }

      setPhase('booting');
      appendLog('[despy] WebContainer 부팅 중…\n');
      await bootWebContainer();

      setPhase('mounting');
      appendLog('[despy] 프로젝트 파일 mount 중…\n');
      await mountProjectFiles(initialFiles);

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
  }, [template, challengeId, appendLog]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    // 과제 워크스페이스는 IndexedDB 복원(비동기)이 끝난 뒤 mount해야 저장된 편집분이
    // 반영된다. challengeId가 없으면(PoC) 복원 대상이 없어 즉시 시작한다.
    if (challengeId && !hasHydrated) return;
    hasStartedRef.current = true;
    queueMicrotask(() => void start());
  }, [start, challengeId, hasHydrated]);

  // 언마운트 시 대기 중인 FS 쓰기 정리 + 보류된 파일 델타 영속을 즉시 반영(이탈 시
  // 마지막 편집 보존). debounce 타이머가 떠 있으면 취소하고 한 번 flush한다.
  useEffect(() => {
    const fileSync = fileSyncRef.current;
    return () => {
      fileSync?.cancel();
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        persistFileDelta();
      }
    };
  }, [persistFileDelta]);

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
    questionsUsed,
    tokensUsed,
    recordAiTurn,
  };
}
