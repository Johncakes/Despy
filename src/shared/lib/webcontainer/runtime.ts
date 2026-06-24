/**
 * runtime.ts — WebContainer 저수준 제어 래퍼 (탭당 1개 싱글턴)
 *
 * 브라우저 내 Node 런타임(WebContainer)의 부팅·mount·프로세스 실행을 캡슐화한다.
 * WebContainer는 SharedArrayBuffer를 쓰므로 cross-origin isolated 페이지에서만
 * 부팅되고(헤더는 next.config.ts), **탭당 단 1개 인스턴스**만 boot할 수 있다.
 * 따라서 인스턴스를 모듈 전역 싱글턴으로 보관하고, 동시/중복 boot 호출(React
 * StrictMode의 이펙트 2회 실행 등)은 bootPromise로 합쳐 단일 boot를 보장한다.
 *
 * @webcontainer/api는 브라우저 전용(SSR 시 평가되면 안 됨)이라 값 import는
 * boot 시점에 동적 import로 미룬다(상단은 `import type`만 — 빌드에서 제거됨).
 *
 * 레이어 규칙: 이 파일은 외부 라이브러리(@webcontainer/api)만 의존한다.
 * feature는 이 래퍼를 직접 쓰지 않고 훅(features/solve/useWorkspace)으로 감싼다.
 *
 * 사용처: features/solve/useWorkspace (React 통합)
 */
import type {
  DirectoryNode,
  FileSystemTree,
  WebContainer,
  WebContainerProcess,
} from '@webcontainer/api';
import type {
  ApiConsoleRequest,
  ApiConsoleResponse,
  ProjectFiles,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/** 프로세스 출력(stdout+stderr 통합) 스트림 콜백 */
export type OutputListener = (chunk: string) => void;

/** dev 서버가 준비되었을 때의 접속 정보 */
export interface DevServerInfo {
  port: number;
  /** 미리보기 iframe에 꽂을 URL */
  url: string;
}

/** 타임아웃 가드가 붙은 명령 실행 결과 */
export interface CommandResult {
  /** 프로세스 종료 코드 (timedOut=true면 kill에 의한 값이라 신뢰 불가) */
  exitCode: number;
  /** 타임아웃으로 강제 종료(kill)되었으면 true */
  timedOut: boolean;
}

// ── 싱글턴 상태 ──────────────────────────────────────────────────────────────

/** 부팅된 WebContainer 인스턴스(탭당 1개). 미부팅이면 null. */
let containerInstance: WebContainer | null = null;
/** 부팅 진행 중 Promise — 중복 boot 호출을 단일 부팅으로 합친다. */
let bootPromise: Promise<WebContainer> | null = null;
/** 현재 구동 중인 dev 서버 프로세스(teardown 시 종료용). */
let devProcess: WebContainerProcess | null = null;

// ── API 요청 콘솔 헬퍼 ────────────────────────────────────────────────────────

/** 컨테이너 안에 쓰는 요청 실행 스크립트 경로(학생 파일트리 밖 — 화면에 안 보임). */
const REQUEST_HELPER_PATH = '.despy-request.mjs';
/** 헬퍼 stdout에서 결과 JSON을 감싸는 센티넬(npm/node 잡음과 분리). */
const RESP_PREFIX = '__DESPY_RESP__';
const RESP_SUFFIX = '__DESPY_END__';

/**
 * 컨테이너 안에서 실행되는 요청 스크립트 소스.
 *
 * 호스트(despy)에서 미리보기 URL로 직접 fetch하면 cross-origin + COEP/CORS에 막히므로,
 * 같은 컨테이너의 node로 localhost 백엔드에 요청을 보낸다. 메서드/경로/바디/포트는 env로
 * 받고(인자 따옴표 이슈 회피), 결과를 센티넬로 감싼 JSON 한 줄로 stdout에 출력한다.
 */
const REQUEST_HELPER_SOURCE = `import http from 'node:http';

const method = process.env.DESPY_METHOD || 'GET';
const path = process.env.DESPY_PATH || '/';
const body = process.env.DESPY_BODY || '';
const port = Number(process.env.DESPY_PORT || '3000');
const started = Date.now();

function emit(result) {
  process.stdout.write('${RESP_PREFIX}' + JSON.stringify(result) + '${RESP_SUFFIX}');
}

const headers = {};
if (body) headers['content-type'] = 'application/json';

const req = http.request({ host: 'localhost', port, path, method, headers }, (res) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    const headers = {};
    for (const [key, value] of Object.entries(res.headers)) {
      headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    emit({
      ok: true,
      status: res.statusCode,
      statusText: res.statusMessage,
      durationMs: Date.now() - started,
      headers,
      body: data,
    });
  });
});
req.on('error', (err) =>
  emit({ ok: false, durationMs: Date.now() - started, error: String(err && err.message ? err.message : err) }),
);
if (body) req.write(body);
req.end();
`;

// ── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * WebContainer를 부팅한다(탭당 1회). 이미 부팅됐거나 부팅 중이면 그 결과를 재사용.
 * coep는 페이지 COEP 헤더(require-corp)와 일치시킨다.
 */
export async function bootWebContainer(): Promise<WebContainer> {
  if (containerInstance) return containerInstance;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    // 브라우저 전용 모듈 — 여기(클라이언트 런타임)서만 평가되도록 동적 import.
    const { WebContainer: WebContainerClass } = await import('@webcontainer/api');
    const instance = await WebContainerClass.boot({ coep: 'require-corp' });
    containerInstance = instance;
    return instance;
  })();

  return bootPromise;
}

/**
 * 프로젝트 파일트리(평면 맵)를 WebContainer 가상 FS에 mount한다.
 * 부팅 전이면 먼저 부팅한다.
 */
export async function mountProjectFiles(files: ProjectFiles): Promise<void> {
  const container = await bootWebContainer();
  await container.mount(toFileSystemTree(files));
}

/**
 * 명령을 실행하고 종료 코드를 반환한다(예: `npm install`).
 * 출력은 onOutput으로 스트리밍한다(콘솔 패널 연결용).
 */
export async function runCommand(
  command: string,
  args: string[],
  onOutput?: OutputListener,
): Promise<number> {
  const container = await bootWebContainer();
  const process = await container.spawn(command, args);
  pipeOutput(process, onOutput);
  return process.exit;
}

/**
 * 명령을 실행하되 timeoutMs 안에 끝나지 않으면 kill하고 결과에 timedOut=true를 담는다.
 * 학생/AI 코드에 무한 루프·무한 빌드가 섞여 탭이 멈추는 것을 막는 프로세스 가드다
 * (특히 test 실행 — docs/spec-webcontainer.md §3.4). 출력은 onOutput으로 스트리밍한다.
 */
export async function runCommandWithTimeout(
  command: string,
  args: string[],
  options: { onOutput?: OutputListener; timeoutMs: number },
): Promise<CommandResult> {
  const container = await bootWebContainer();
  const process = await container.spawn(command, args);
  pipeOutput(process, options.onOutput);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    process.kill();
  }, options.timeoutMs);

  try {
    const exitCode = await process.exit;
    return { exitCode, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

/** startDevServer 옵션 */
export interface StartDevServerOptions {
  /** 프로세스 출력 스트림 콜백(콘솔 패널 연결용). */
  onOutput?: OutputListener;
  /**
   * 미리보기로 확정할 포트(풀스택 멀티포트용). 지정하면 이 포트의 server-ready에서만
   * resolve하고 다른 포트(예: 백엔드 API)의 이벤트는 무시한다. 생략하면 첫 server-ready로
   * 확정한다(단일 서버 템플릿 — 기존 동작 유지).
   */
  previewPort?: number;
}

/**
 * dev 서버를 띄우고 `server-ready` 이벤트를 기다려 접속 정보를 반환한다.
 * dev 프로세스는 계속 살아 있으므로 exit를 await하지 않고, server-ready로 resolve한다.
 * 준비 전에 프로세스가 종료되면(설정 오류 등) reject한다.
 *
 * 풀스택(프론트 Vite + 백 Express 동시 구동)은 포트마다 server-ready가 발생하므로
 * options.previewPort로 미리보기에 꽂을 프론트 포트만 골라 resolve한다. 백엔드 포트는
 * Vite proxy(같은 컨테이너 localhost) 뒤로만 쓰이므로 미리보기 URL이 필요 없다.
 *
 * onOutput은 하위호환을 위해 양식 두 가지를 모두 받는다:
 *   - 함수: 기존 시그니처(onOutput 콜백)
 *   - 객체: StartDevServerOptions(onOutput + previewPort)
 */
export async function startDevServer(
  command: string,
  args: string[],
  onOutputOrOptions?: OutputListener | StartDevServerOptions,
): Promise<DevServerInfo> {
  const options: StartDevServerOptions =
    typeof onOutputOrOptions === 'function'
      ? { onOutput: onOutputOrOptions }
      : (onOutputOrOptions ?? {});

  const container = await bootWebContainer();
  const process = await container.spawn(command, args);
  devProcess = process;
  pipeOutput(process, options.onOutput);

  return new Promise<DevServerInfo>((resolve, reject) => {
    const unsubscribe = container.on('server-ready', (port, url) => {
      // previewPort가 지정되면 그 포트(프론트)에서만 미리보기를 확정하고,
      // 다른 포트(백엔드 API 등)의 server-ready는 무시하고 계속 기다린다.
      if (options.previewPort !== undefined && port !== options.previewPort) return;
      unsubscribe();
      resolve({ port, url });
    });
    // server-ready 전에 프로세스가 죽으면 실패로 간주.
    process.exit
      .then((exitCode) => {
        unsubscribe();
        reject(new Error(`dev 서버가 준비되기 전에 종료되었습니다 (exit ${exitCode}).`));
      })
      .catch(() => {
        /* server-ready 후 resolve된 경우의 잔여 거부는 무시 */
      });
  });
}

/** WebContainer가 이미 부팅된 상태인지 반환한다(재진입 감지용). */
export function isContainerBooted(): boolean {
  return containerInstance !== null;
}

/**
 * 컨테이너 안에서 백엔드(localhost:port)로 HTTP 요청을 한 번 보내고 결과를 반환한다.
 *
 * 호스트에서 미리보기 URL로 직접 fetch하면 cross-origin + COEP/CORS에 막히므로, 요청을
 * 컨테이너 *안에서* node로 실행한다(REQUEST_HELPER_SOURCE). 헬퍼를 FS에 쓴 뒤 env로
 * 메서드/경로/바디/포트를 넘겨 spawn하고, stdout의 센티넬 사이 JSON을 파싱한다.
 *
 * 매 호출마다 헬퍼를 쓰는 비용은 작고, mount로 덮였을 가능성에도 안전하다. 수동 'Send'
 * 버튼용이라 요청당 node 프로세스 1회 spawn(수백 ms)도 충분하다.
 *
 * 실행/파싱 실패는 throw하지 않고 ok:false 응답으로 돌려준다(콘솔에서 사유를 보여주려고).
 */
export async function sendHttpRequest(
  request: ApiConsoleRequest & { port: number },
): Promise<ApiConsoleResponse> {
  const started = Date.now();
  try {
    const container = await bootWebContainer();
    await container.fs.writeFile(REQUEST_HELPER_PATH, REQUEST_HELPER_SOURCE);

    const process = await container.spawn('node', [REQUEST_HELPER_PATH], {
      env: {
        DESPY_METHOD: request.method,
        DESPY_PATH: request.path,
        DESPY_BODY: request.body ?? '',
        DESPY_PORT: String(request.port),
      },
    });

    let buffer = '';
    process.output
      .pipeTo(
        new WritableStream<string>({
          write(chunk) {
            buffer += chunk;
          },
        }),
      )
      .catch(() => {
        /* 프로세스 종료에 따른 스트림 취소는 정상 흐름이므로 무시 */
      });

    const exitCode = await process.exit;

    const start = buffer.indexOf(RESP_PREFIX);
    const end = buffer.indexOf(RESP_SUFFIX);
    if (start === -1 || end === -1 || end < start) {
      return {
        ok: false,
        durationMs: Date.now() - started,
        error: `응답을 파싱하지 못했습니다 (exit ${exitCode}). 서버가 실행 중인지 확인하세요.`,
      };
    }
    const json = buffer.slice(start + RESP_PREFIX.length, end);
    return JSON.parse(json) as ApiConsoleResponse;
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 실행 중인 dev 서버 프로세스를 종료하고 참조를 비운다.
 * 재진입 시 포트를 비워 새 dev 서버를 같은 포트에서 시작할 수 있게 한다.
 */
export function killDevServer(): void {
  devProcess?.kill();
  devProcess = null;
}

/**
 * 인스턴스를 정리하고 싱글턴 상태를 초기화한다.
 * ⚠️ WebContainer는 탭당 1회만 boot 가능하므로, teardown 후 같은 탭에서의
 * 재부팅은 보장되지 않는다. 완전한 재시작이 필요하면 페이지를 새로고침한다.
 */
export function teardownWebContainer(): void {
  devProcess?.kill();
  devProcess = null;
  containerInstance?.teardown();
  containerInstance = null;
  bootPromise = null;
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/**
 * 평면 경로 맵(`{ 'src/App.jsx': '...' }`)을 WebContainer FileSystemTree
 * (중첩 디렉토리 구조)로 변환한다.
 */
function toFileSystemTree(files: ProjectFiles): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, contents] of Object.entries(files)) {
    const segments = path.split('/').filter(Boolean);
    let cursor = tree;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      if (isLeaf) {
        cursor[segment] = { file: { contents } };
        return;
      }
      const existing = cursor[segment];
      if (existing && 'directory' in existing) {
        cursor = existing.directory;
      } else {
        const dirNode: DirectoryNode = { directory: {} };
        cursor[segment] = dirNode;
        cursor = dirNode.directory;
      }
    });
  }

  return tree;
}

/** 프로세스 출력 스트림을 onOutput 콜백으로 흘려보낸다. */
function pipeOutput(process: WebContainerProcess, onOutput?: OutputListener): void {
  if (!onOutput) return;
  process.output
    .pipeTo(
      new WritableStream<string>({
        write(chunk) {
          onOutput(chunk);
        },
      }),
    )
    .catch(() => {
      /* 프로세스 종료에 따른 스트림 취소는 정상 흐름이므로 무시 */
    });
}
