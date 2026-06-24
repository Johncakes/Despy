/**
 * useProctoringMonitor.ts — 시험 감독 이벤트 추적 훅
 *
 * 학생이 풀이 화면을 벗어나거나 외부 내용을 붙여넣는 행위를 감지·카운트한다.
 * 실시간으로 화면에 경고 배지를 보여주고, 제출 시 IntegrityLog를 첨부해
 * 교수 대시보드에서 사후 분석할 수 있도록 한다.
 *
 * 감지 항목:
 * - tabSwitchCount: visibilitychange(hidden) + window blur 횟수
 * - tabSwitchTotalMs: 탭이 숨겨진 누적 시간(ms)
 * - externalPasteCount: 30자 초과 붙여넣기 횟수(외부 AI·코드 유입 휴리스틱)
 * - fullscreenExitCount: 전체화면 이탈 횟수
 *
 * ⚠️ 억제(deterrence) 수준. 개발자도구·다른 기기로 우회 가능하며
 *    확실한 차단은 Electron 앱이 필요하다(docs/spec-anti-cheating.md 참조).
 *
 * 사용처: features/solve/SolveView, features/solve/ChallengeSolveView
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface IntegrityLog {
  /** visibilitychange(hidden) + window blur 감지 횟수 */
  tabSwitchCount: number;
  /** 탭이 숨겨진 누적 시간(ms) */
  tabSwitchTotalMs: number;
  /** 30자 초과 붙여넣기 횟수 */
  externalPasteCount: number;
  /** 전체화면 이탈 횟수(전체화면 진입 후 나간 경우만 카운트) */
  fullscreenExitCount: number;
}

export interface ProctoringMonitor {
  /** 현재 누적 로그(리액티브 — 헤더 배지 표시용) */
  log: IntegrityLog;
  /** 현재 전체화면 여부 */
  isFullscreen: boolean;
  /** 전체화면 진입 요청(브라우저 보안상 유저 제스처 필요) */
  requestFullscreen: () => void;
  /** 최신 로그 스냅샷(비리액티브 — 제출 시점에 사용) */
  getLog: () => IntegrityLog;
}

const INITIAL_LOG: IntegrityLog = {
  tabSwitchCount: 0,
  tabSwitchTotalMs: 0,
  externalPasteCount: 0,
  fullscreenExitCount: 0,
};

const PASTE_THRESHOLD_CHARS = 30;

// ── Hook ──────────────────────────────────────────────────────────────────

export function useProctoringMonitor(): ProctoringMonitor {
  const [log, setLog] = useState<IntegrityLog>(INITIAL_LOG);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 비리액티브 참조 — 이벤트 핸들러가 stale closure 없이 최신 카운터를 읽는다.
  const logRef = useRef<IntegrityLog>(INITIAL_LOG);
  // 탭이 숨겨진 시작 시점(ms). null이면 현재 보이는 상태.
  const hiddenSinceRef = useRef<number | null>(null);
  // 전체화면에 진입한 적이 있어야 이탈 카운트 의미 있음.
  const wasFullscreenRef = useRef(false);

  const update = useCallback((patch: Partial<IntegrityLog>) => {
    const next = { ...logRef.current, ...patch };
    logRef.current = next;
    setLog({ ...next });
  }, []);

  useEffect(() => {
    // ── 탭 숨김 / 포커스 이탈 ─────────────────────────────────────────────
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = performance.now();
        update({ tabSwitchCount: logRef.current.tabSwitchCount + 1 });
      } else if (hiddenSinceRef.current !== null) {
        const elapsed = performance.now() - hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        update({ tabSwitchTotalMs: logRef.current.tabSwitchTotalMs + elapsed });
      }
    };

    // ── 외부 붙여넣기 ──────────────────────────────────────────────────────
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text') ?? '';
      if (text.length > PASTE_THRESHOLD_CHARS) {
        update({ externalPasteCount: logRef.current.externalPasteCount + 1 });
      }
    };

    // ── 전체화면 상태 변화 ─────────────────────────────────────────────────
    const handleFullscreenChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(nowFullscreen);
      if (nowFullscreen) {
        wasFullscreenRef.current = true;
      } else if (wasFullscreenRef.current) {
        update({ fullscreenExitCount: logRef.current.fullscreenExitCount + 1 });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      // 언마운트 시 숨겨져 있었다면 누적 시간 정산.
      if (hiddenSinceRef.current !== null) {
        const elapsed = performance.now() - hiddenSinceRef.current;
        logRef.current = {
          ...logRef.current,
          tabSwitchTotalMs: logRef.current.tabSwitchTotalMs + elapsed,
        };
      }
    };
  }, [update]);

  const requestFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen().catch(() => {
      // 일부 환경(iframe·일부 모바일)에서 fullscreen이 거부될 수 있다 — 무시.
    });
  }, []);

  const getLog = useCallback((): IntegrityLog => ({ ...logRef.current }), []);

  return { log, isFullscreen, requestFullscreen, getLog };
}
