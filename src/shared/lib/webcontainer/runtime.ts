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
  MlEvalResult,
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

/** ML 평가(eval) 스크립트가 점수 JSON을 감싸 출력하는 센티넬(학습 로그와 분리). */
const SCORE_PREFIX = '__DESPY_SCORE__';
const SCORE_SUFFIX = '__DESPY_SCORE_END__';

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

// ── 미리보기 콘솔 브리지 ──────────────────────────────────────────────────────

/**
 * 미리보기(앱) 페이지마다 주입되는 콘솔 포워딩 스크립트.
 *
 * 미리보기는 cross-origin iframe(webcontainer.io)이라 호스트(despy)에서 그 안의
 * console에 직접 접근할 수 없다. 그래서 앱 스크립트보다 먼저 실행되는 이 스크립트로
 * console.*(log/info/warn/error/debug)와 전역 에러(uncaught·unhandledrejection)를
 * 가로채 `postMessage`로 부모(despy)에 보낸다. 부모는 useWorkspace의 message 리스너로
 * 받아 '브라우저 콘솔' 탭에 표시한다. 인자는 문자열화해 보낸다(직렬화 불가 시 String 폴백).
 *
 * ⚠️ 이 문자열은 바깥 템플릿 리터럴 안에 들어가므로 백틱과 ${} 보간을 쓰지 않는다
 *    (문자열 결합으로만 작성). __despyConsoleBridge 가드로 중복 주입을 막는다.
 */
const PREVIEW_CONSOLE_SCRIPT = `(() => {
  if (window.__despyConsoleBridge) return;
  window.__despyConsoleBridge = true;
  var SOURCE = 'despy-console';
  var send = function (level, args) {
    try {
      var parts = Array.prototype.map.call(args, function (value) {
        if (typeof value === 'string') return value;
        if (value instanceof Error) return value.stack || value.message;
        try { return JSON.stringify(value); } catch (e) { return String(value); }
      });
      window.parent.postMessage({ source: SOURCE, level: level, message: parts.join(' ') }, '*');
    } catch (e) { /* 부모 접근 불가 등은 무시 */ }
  };
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : null;
    console[level] = function () { send(level, arguments); if (original) original.apply(console, arguments); };
  });
  window.addEventListener('error', function (event) {
    var where = event.filename ? ' (' + event.filename + ':' + event.lineno + ':' + event.colno + ')' : '';
    send('error', [(event.message || 'Uncaught error') + where]);
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var text = reason && reason.stack ? reason.stack : (reason && reason.message ? reason.message : String(reason));
    send('error', ['Unhandled promise rejection: ' + text]);
  });
})();`;

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
 * 미리보기 콘솔 브리지를 설치한다 — 미리보기 페이지마다 PREVIEW_CONSOLE_SCRIPT를
 * 주입해 앱의 console 및 런타임 에러를 부모로 중계한다. dev 서버(미리보기 로드)보다
 * 먼저 호출해야 앱 코드 실행 전에 가로채기가 걸린다. setPreviewScript는 멱등이라
 * 재진입 시 다시 호출해도 안전하다.
 */
export async function installPreviewConsoleBridge(): Promise<void> {
  const container = await bootWebContainer();
  await container.setPreviewScript(PREVIEW_CONSOLE_SCRIPT);
}

/** 컨테이너 FS에서 파일을 읽어 문자열로 반환한다. 없거나 읽기 실패면 null. */
export async function readContainerFile(path: string): Promise<string | null> {
  const container = await bootWebContainer();
  return readFileOrNull(container, path);
}

/**
 * 컨테이너 파일 변화를 구독한다('DB 상태' 라이브 뷰용 — db.json watch).
 *
 * 구독 즉시 현재 내용을 1회 onChange로 알리고(watch는 변경분만 알림), 이후 파일이 바뀔
 * 때마다 최신 내용(없으면 null)을 전달한다. 반환한 함수로 구독을 해제한다. watch 설치가
 * 실패해도(파일 부재 등) 초기 1회 읽기는 보장하고 no-op 해제 함수를 돌려준다.
 */
export async function watchContainerFile(
  path: string,
  onChange: (content: string | null) => void,
): Promise<() => void> {
  const container = await bootWebContainer();
  onChange(await readFileOrNull(container, path));
  try {
    const watcher = container.fs.watch(path, () => {
      void readFileOrNull(container, path).then(onChange);
    });
    return () => watcher.close();
  } catch {
    return () => {};
  }
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

// ── ML 평가(점수) 실행 ────────────────────────────────────────────────────

/** runScoreEval 옵션 */
export interface RunScoreEvalOptions {
  /** 평가 프로세스 출력 스트림 콜백(학습 로그를 콘솔/점수 패널에 표시). */
  onOutput?: OutputListener;
  /** 이 시간 안에 끝나지 않으면 kill하고 timedOut=true로 돌려준다. */
  timeoutMs: number;
  /** 평가 프로세스에 넘길 환경변수(예: 고정 seed DESPY_SEED). */
  env?: Record<string, string>;
}

/** ML 평가 실행 결과 — 점수(파싱 성공) 또는 실패 사유. */
export interface ScoreEvalOutcome {
  /** 점수 센티넬을 정상 파싱했는지. false면 error에 사유. */
  ok: boolean;
  /** 파싱된 점수(ok일 때). */
  result?: MlEvalResult;
  /** 실패 사유(파싱 실패·타임아웃·실행 오류). */
  error?: string;
  /** 평가 프로세스의 원시 출력(디버깅·콘솔 표시용). */
  rawOutput: string;
  /** 타임아웃으로 강제 종료되었으면 true. */
  timedOut: boolean;
  /** 프로세스 종료 코드(timedOut=true면 kill 값이라 신뢰 불가). */
  exitCode: number;
}

/**
 * ML 평가 스크립트(예: `node eval.mjs`)를 실행해 점수 센티넬을 회수한다.
 *
 * sendHttpRequest와 같은 일회성 spawn → 출력 버퍼링 → 센티넬 슬라이스 → JSON.parse
 * 패턴이되, 점수 평가용이라 SCORE 센티넬을 찾고 타임아웃 가드를 둔다(학습/추론이 무한
 * 루프거나 너무 길면 탭이 멈추는 것을 막는다 — runCommandWithTimeout과 같은 취지).
 * 학습 로그는 onOutput으로 스트리밍해 점수 패널/콘솔에 흘린다.
 *
 * 실행/파싱 실패는 throw하지 않고 ok:false 결과로 돌려준다(패널에서 사유를 보여주려고).
 */
export async function runScoreEval(
  command: string,
  args: string[],
  options: RunScoreEvalOptions,
): Promise<ScoreEvalOutcome> {
  const container = await bootWebContainer();
  const process = await container.spawn(command, args, {
    env: options.env ?? {},
  });

  let buffer = '';
  process.output
    .pipeTo(
      new WritableStream<string>({
        write(chunk) {
          buffer += chunk;
          options.onOutput?.(chunk);
        },
      }),
    )
    .catch(() => {
      /* 프로세스 종료에 따른 스트림 취소는 정상 흐름이므로 무시 */
    });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    process.kill();
  }, options.timeoutMs);

  let exitCode: number;
  try {
    exitCode = await process.exit;
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) {
    return {
      ok: false,
      error: `평가가 ${Math.round(options.timeoutMs / 1000)}초 안에 끝나지 않아 중단했습니다.`,
      rawOutput: buffer,
      timedOut,
      exitCode,
    };
  }

  const start = buffer.indexOf(SCORE_PREFIX);
  const end = buffer.indexOf(SCORE_SUFFIX);
  if (start === -1 || end === -1 || end < start) {
    // 센티넬이 없으면 eval이 점수 출력 전에 실패한 것이다. 실제 원인(모듈 부재·런타임
    // 오류 등)을 알 수 있게 출력 꼬리를 잘라 에러 메시지에 함께 싣는다(콘솔 탭과 별개로
    // 성능 점수 탭에서 바로 보이도록).
    const tail = buffer.trim().slice(-600);
    const detail = tail ? `\n--- eval 출력 ---\n${tail}` : ' (출력 없음 — eval 실행 자체가 실패했을 수 있습니다.)';
    return {
      ok: false,
      error: `점수 출력을 찾지 못했습니다 (exit ${exitCode}). eval이 ${SCORE_PREFIX} 센티넬을 출력하기 전에 실패했습니다.${detail}`,
      rawOutput: buffer,
      timedOut,
      exitCode,
    };
  }

  const json = buffer.slice(start + SCORE_PREFIX.length, end);
  try {
    const parsed = JSON.parse(json) as MlEvalResult;
    if (typeof parsed.value !== 'number' || !Number.isFinite(parsed.value)) {
      return {
        ok: false,
        error: '점수 값이 유효한 숫자가 아닙니다.',
        rawOutput: buffer,
        timedOut,
        exitCode,
      };
    }
    return { ok: true, result: parsed, rawOutput: buffer, timedOut, exitCode };
  } catch {
    return {
      ok: false,
      error: '점수 JSON 파싱에 실패했습니다.',
      rawOutput: buffer,
      timedOut,
      exitCode,
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

/** 파일을 utf-8로 읽어 반환하고, 없거나 실패하면 null(throw하지 않음). */
async function readFileOrNull(
  container: WebContainer,
  path: string,
): Promise<string | null> {
  try {
    return await container.fs.readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

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
