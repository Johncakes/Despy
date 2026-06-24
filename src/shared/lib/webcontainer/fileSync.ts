/**
 * fileSync.ts — 에디터 버퍼 → WebContainer FS 단방향 동기화 (경로별 debounce)
 *
 * 워크스페이스의 단일 출처는 에디터(메모리) 버퍼이고, 변경분을 WebContainer 가상
 * FS로 단방향 기록한다. dev 서버(Vite)가 FS 변경을 감지해 HMR로 미리보기를 갱신한다.
 * (docs/spec-webcontainer.md §3.3) 학생 편집과 AI 미러링이 모두 이 경로를 공유한다.
 *
 * 매 키 입력마다 FS에 쓰면 과도하므로 경로별로 debounce해 마지막 내용만 기록한다.
 *
 * 레이어 규칙: shared/lib 내부(runtime, utils/logger)만 의존한다.
 *
 * 사용처: features/solve/useWorkspace (에디터/AI 변경을 FS로 반영)
 */
import { bootWebContainer } from '@/shared/lib/webcontainer/runtime';
import { logger } from '@/shared/lib/utils/logger';

// ── Constants ─────────────────────────────────────────────────────────────

/** 기본 debounce 지연(ms) — 입력이 멈춘 뒤 이 시간이 지나면 FS에 기록 */
const DEFAULT_DEBOUNCE_MS = 250;

// ── Types ─────────────────────────────────────────────────────────────────

export interface FileSync {
  /** 경로의 최신 내용을 예약(debounce 후 FS 기록) */
  schedule: (path: string, contents: string) => void;
  /** 대기 중인 모든 쓰기를 취소(언마운트 정리용) */
  cancel: () => void;
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 단일 파일을 WebContainer FS에 즉시 기록한다(부모 디렉토리는 보장 후 생성).
 * 부팅 전이면 먼저 부팅한다.
 */
export async function writeWorkspaceFile(path: string, contents: string): Promise<void> {
  const container = await bootWebContainer();
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash > 0) {
    // 중첩 경로의 부모 디렉토리 보장(이미 있으면 no-op)
    await container.fs.mkdir(path.slice(0, lastSlash), { recursive: true });
  }
  await container.fs.writeFile(path, contents);
}

/**
 * 경로별 debounce 동기화기를 생성한다. 같은 경로로 연속 schedule이 오면
 * 마지막 내용만 한 번 기록한다(경로마다 독립 타이머).
 */
export function createFileSync(delayMs: number = DEFAULT_DEBOUNCE_MS): FileSync {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const latestContents = new Map<string, string>();

  const flush = (path: string) => {
    const contents = latestContents.get(path);
    timers.delete(path);
    latestContents.delete(path);
    if (contents === undefined) return;
    void writeWorkspaceFile(path, contents).catch((error) => {
      logger.error('[fileSync] 파일 쓰기 실패', path, error);
    });
  };

  return {
    schedule(path, contents) {
      latestContents.set(path, contents);
      const existing = timers.get(path);
      if (existing) clearTimeout(existing);
      timers.set(
        path,
        setTimeout(() => flush(path), delayMs),
      );
    },
    cancel() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      latestContents.clear();
    },
  };
}
