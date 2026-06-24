/**
 * useWorkspace.ts — WebContainer 라이프사이클을 React로 감싸는 훅
 *
 * shared/lib/webcontainer/runtime의 저수준 싱글턴 API를, 마운트 시 자동으로
 * 부팅→mount→npm install→npm run dev 시퀀스를 진행하고 그 진행 단계(phase)·
 * 콘솔 로그·미리보기 URL·에러를 React 상태로 노출하는 훅이다. 레이어 규칙상
 * feature는 WebContainer 런타임을 이 훅을 통해서만 사용한다(컴포넌트는 결과만 구독).
 *
 * WebContainer 인스턴스는 React state가 아니라 shared/lib 싱글턴이 보유한다.
 * StrictMode의 이펙트 2회 실행에 대비해 시퀀스는 ref 가드로 1회만 시작한다.
 *
 * 사용처: features/solve/WorkspacePlaygroundView (P0 PoC), 이후 SolveView 워크스페이스
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectFiles } from '@/shared/core/types';
import {
  bootWebContainer,
  mountProjectFiles,
  runCommand,
  startDevServer,
} from '@/shared/lib/webcontainer/runtime';
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
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWorkspace(files: ProjectFiles): UseWorkspaceResult {
  // 시퀀스가 한 번만 시작되도록 가드(StrictMode 이펙트 2회 실행 방지).
  const hasStartedRef = useRef(false);

  const [phase, setPhase] = useState<WorkspacePhase>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const appendLog = useCallback((chunk: string) => {
    setLogs((prev) => [...prev, chunk]);
  }, []);

  const start = useCallback(async () => {
    try {
      setPhase('booting');
      appendLog('[despy] WebContainer 부팅 중…\n');
      await bootWebContainer();

      setPhase('mounting');
      appendLog('[despy] 프로젝트 파일 mount 중…\n');
      await mountProjectFiles(files);

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
  }, [files, appendLog]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void start();
  }, [start]);

  const retry = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  return { phase, logs, previewUrl, errorMessage, retry };
}
