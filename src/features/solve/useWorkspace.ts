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
import type {
  ApiConsoleConfig,
  ApiConsoleRequest,
  ApiConsoleResponse,
  ApiEndpoint,
  ApiLogEntry,
  AutoTestResult,
  MlEvalResult,
  MlSpec,
  ProjectFiles,
} from '@/shared/core/types';
import {
  getWorkspaceSession,
  useWorkspaceStore,
} from '@/shared/core/stores/workspaceStore';
import {
  bootWebContainer,
  installPreviewConsoleBridge,
  isContainerBooted,
  killDevServer,
  mountProjectFiles,
  runCommand,
  runScoreEval,
  sendHttpRequest,
  startDevServer,
  watchContainerFile,
} from '@/shared/lib/webcontainer/runtime';
import {
  createFileSync,
  removeWorkspacePath,
  renameWorkspacePath,
  type FileSync,
} from '@/shared/lib/webcontainer/fileSync';
import { runTests as runTestSuite } from '@/shared/lib/webcontainer/testRunner';
import { FULLSTACK_PREVIEW_PORT } from '@/shared/core/constants/webcontainerTemplates';
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

/** 브라우저 콘솔(미리보기 앱) 로그 레벨 */
export type BrowserConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** 미리보기 앱이 보낸 콘솔 1줄(브라우저 콘솔 탭 표시용) */
export interface BrowserConsoleEntry {
  level: BrowserConsoleLevel;
  message: string;
  /** 수신 시각(ms) — key·정렬용 */
  timestamp: number;
}

/**
 * ML 챌린지 워크스페이스 설정 — kind === 'ml'일 때만 주어진다(없으면 워크스페이스 과제).
 * 주어지면 dev 서버(미리보기)를 띄우지 않고, runEvaluation으로 숨긴 test셋을 주입·평가한다.
 */
export interface WorkspaceMlConfig {
  /** 평가지표·임계값·seed·평가 명령(MlSpec). */
  spec: MlSpec;
  /** 숨긴 test 파일트리(채점 시점에만 mount). ChallengeProblem.testFiles. */
  testFiles: ProjectFiles;
}

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
  /** 빈 새 파일을 생성하고 즉시 연다. 이미 있으면 열기만, 잠금 경로면 무시. */
  createFile: (path: string) => void;
  /** 파일 또는 폴더(경로 프리픽스) 전체를 삭제한다(버퍼+FS). 잠금 파일은 제외. */
  deletePath: (path: string) => void;
  /** 파일/폴더 경로를 변경(이동)한다. 잠금 파일 포함 시 무시. */
  renamePath: (fromPath: string, toPath: string) => void;
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

  // ── ML 평가 (성능 점수) ──
  /**
   * ML 챌린지 평가 — 숨긴 test셋을 mount하고 evalCommand를 실행해 성능 지표를 회수한다.
   * 최신 편집분을 먼저 FS에 반영한 뒤 평가하며, 결과는 evalResult로도 노출된다.
   * ML 챌린지가 아니면(mlConfig 없음) null을 돌려준다. 실패 시 null.
   */
  runEvaluation: () => Promise<MlEvalResult | null>;
  /** 마지막 평가 결과(지표값, 미실행이면 null) */
  evalResult: MlEvalResult | null;
  /** 평가 실행 중 여부 */
  isRunningEval: boolean;
  /** 평가 실패 메시지(센티넬 부재·타임아웃 등, 정상이면 null) */
  evalErrorMessage: string | null;

  // ── 브라우저 콘솔 (미리보기 앱) ──
  /** 미리보기 앱이 출력한 console.* / 런타임 에러 항목(누적, 최대 MAX_CONSOLE_ENTRIES개). */
  consoleEntries: BrowserConsoleEntry[];
  /** 브라우저 콘솔 항목을 모두 비운다. */
  clearConsole: () => void;

  // ── 백엔드 API 요청 콘솔 ──
  /**
   * API 요청 콘솔 설정(백엔드가 있는 템플릿에만). 없으면 null(순수 프론트 — 콘솔 숨김).
   * 템플릿에서 추론한다(Express 단독·풀스택 → 포트 3000).
   */
  apiConsole: ApiConsoleConfig | null;
  /**
   * 컨테이너 안에서 백엔드로 HTTP 요청을 한 번 보내고 결과를 반환한다(콘솔 'Send'용).
   * 백엔드가 없는 템플릿이면 ok:false 응답을 돌려준다.
   */
  sendApiRequest: (request: ApiConsoleRequest) => Promise<ApiConsoleResponse>;
  /**
   * 데이터 상태 뷰(테이블)가 보여줄 컬렉션 조회 결과(미로드면 null). API 호출로 데이터가
   * 바뀌면(sendApiRequest의 변경 요청·resetData) 자동 갱신된다.
   */
  apiData: ApiConsoleResponse | null;
  /** 데이터 상태 뷰를 다시 불러오는 중인지. */
  isApiDataLoading: boolean;
  /** 데이터 상태 뷰를 수동 갱신한다(컬렉션 경로 GET). 백엔드 없으면 no-op. */
  refreshApiData: () => Promise<void>;
  /**
   * 데이터 초기화 — dev 서버를 재시작해 인메모리 저장소를 초기 상태로 되돌린다.
   * 백엔드가 없는 템플릿이면 no-op. 진행 상태는 phase('starting'→'ready')로 노출된다.
   */
  resetData: () => Promise<void>;

  // ── 백엔드 실시간 모니터 ──
  /**
   * 백엔드가 처리한 요청/응답 실시간 로그(누적, 최대 MAX_API_LOG_ENTRIES개).
   * 잠긴 서버 진입점의 로깅 미들웨어 출력을 dev 스트림에서 파싱해 채운다. 백엔드가
   * 없으면 항상 빈 배열.
   */
  apiLogs: ApiLogEntry[];
  /** API 로그를 모두 비운다. */
  clearApiLogs: () => void;
  /**
   * 백엔드 저장소(db.json) 현재 상태 — 파일 백업 db를 쓰는 템플릿에서 fs.watch로 실시간
   * 갱신된다(파싱된 JSON). 파일이 없거나 DB 미지원 템플릿이면 null. (apiConsole.dbFilePath)
   */
  dbState: unknown;

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

/** 브라우저 콘솔에 보관하는 최대 항목 수 — 무한 누적(메모리)을 막고 최근 것만 유지. */
const MAX_CONSOLE_ENTRIES = 500;

/** API 로그에 보관하는 최대 항목 수(무한 누적 방지, 최근 것만 유지). */
const MAX_API_LOG_ENTRIES = 500;

/**
 * 백엔드 로깅 미들웨어가 요청 1건을 stdout에 출력할 때 JSON을 감싸는 센티넬.
 * dev 출력 스트림에서 이 사이의 JSON만 골라 구조화 로그로 만든다(나머지는 콘솔 텍스트).
 * 서버 템플릿(server/index.js·src/server.js)의 despyRequestLogger와 문자열이 일치해야 한다.
 */
const API_LOG_PREFIX = '__DESPY_LOG__';
const API_LOG_SUFFIX = '__DESPY_LOG_END__';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 풀스택 템플릿(프론트 Vite + 백 Express를 한 컨테이너에서 동시 구동)에서 미리보기로
 * 확정할 프론트 포트를 추론한다. 두 서버가 각각 server-ready를 내므로, 프론트 포트만
 * 골라야 미리보기에 백엔드 raw JSON이 아닌 프론트 화면이 꽂힌다. 단일 서버 템플릿
 * (Vite 단독·Express 단독)은 undefined → 첫 server-ready로 확정한다(기존 동작 유지).
 *
 * 식별: vite.config.js(프론트)와 server/index.js(백)를 모두 가진 템플릿 = 풀스택.
 * persist 스키마(ChallengeProblem)에 필드를 더하지 않으려고 템플릿 내용으로 추론한다.
 */
function inferPreviewPort(template: ProjectFiles): number | undefined {
  const isFullstack = 'vite.config.js' in template && 'server/index.js' in template;
  return isFullstack ? FULLSTACK_PREVIEW_PORT : undefined;
}

/** 백엔드 API가 listen하는 컨테이너 내부 포트(템플릿 server.js·index.js의 PORT 기본값). */
const BACKEND_API_PORT = 3000;

/**
 * 백엔드가 있는 템플릿에서 API 요청 콘솔 설정을 추론한다(없으면 null — 순수 프론트).
 *
 * 백엔드 식별: Express 진입점(server/index.js[풀스택]·src/server.js[백 단독])이 있으면
 * 백엔드가 있다고 본다. 프론트(index.html) 유무로 콘솔이 주 화면인지(백 단독)와 경로
 * 초기값(/api/todos[풀스택]·/todos[백 단독])을 정한다. 모두 best-effort이며 사용자가 수정한다.
 * persist 스키마 변경을 피하려고 템플릿 내용으로만 추론한다(inferPreviewPort와 동일 원칙).
 */
function inferApiConsoleConfig(template: ProjectFiles): ApiConsoleConfig | null {
  const isFullstack = 'server/index.js' in template;
  const isExpressOnly = 'src/server.js' in template;
  if (!isFullstack && !isExpressOnly) return null;
  const hasFrontend = 'index.html' in template;
  // 파일 백업 db(server/db.js·src/db.js)를 쓰는 템플릿만 DB 상태 뷰를 노출한다.
  // 저장소 파일 경로는 서버 진입점이 쓰는 위치(server/data·src/data)와 일치해야 한다.
  const dbFilePath = isFullstack
    ? 'server/db.js' in template
      ? 'server/data/db.json'
      : undefined
    : 'src/db.js' in template
      ? 'src/data/db.json'
      : undefined;
  return {
    port: BACKEND_API_PORT,
    defaultPath: hasFrontend ? '/api/todos' : '/todos',
    isPrimaryView: !hasFrontend,
    dbFilePath,
    endpoints: [],
    dataPath: hasFrontend ? '/api/todos' : '/todos',
  };
}

/** 백엔드 라우트가 정의되는 소스 파일들(추론 대상). 위에서부터 우선 스캔한다. */
const BACKEND_SOURCE_PATHS = [
  'src/app.js',
  'server/app.js',
  'src/server.js',
  'server/index.js',
] as const;

/** `app.get('/todos', …)`·`router.post('/todos', …)` 형태의 Express 라우트 정의 매칭. */
const ROUTE_DEFINITION_REGEX =
  /\b(?:app|router)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;

/**
 * 백엔드 소스에서 Express 라우트를 정규식으로 추론한다(Swagger식 목록용 · best-effort).
 *
 * 라이브 파일을 스캔하므로 학생이 새 라우트를 구현하면 즉시 목록에 나타난다. 동적으로
 * 등록되는 라우트(반복문·변수 경로)는 잡지 못하지만, 콘솔 목록·프리필 용도라 충분하다.
 */
function parseEndpoints(files: ProjectFiles): ApiEndpoint[] {
  const seen = new Set<string>();
  const endpoints: ApiEndpoint[] = [];
  for (const path of BACKEND_SOURCE_PATHS) {
    const source = files[path];
    if (!source) continue;
    for (const match of source.matchAll(ROUTE_DEFINITION_REGEX)) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const key = `${method} ${routePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      endpoints.push({ method, path: routePath });
    }
  }
  return endpoints;
}

/**
 * 데이터 상태 뷰가 보여줄 컬렉션 조회 경로를 고른다 — 첫 무파라미터(:id 없는) 비루트 GET.
 * 적당한 후보가 없으면 fallback(템플릿 기본 경로)을 쓴다.
 */
function pickDataPath(endpoints: ApiEndpoint[], fallback: string): string {
  const collection = endpoints.find(
    (endpoint) =>
      endpoint.method === 'GET' && !endpoint.path.includes(':') && endpoint.path !== '/',
  );
  return collection?.path ?? fallback;
}

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

/** ML 평가 타임아웃(ms) — 학습+추론은 npm test보다 길 수 있어 넉넉히 둔다(무한 루프 가드). */
const ML_EVAL_TIMEOUT_MS = 120_000;

export function useWorkspace(
  template: ProjectFiles,
  lockedPaths: readonly string[] = [],
  challengeId?: string,
  mlConfig?: WorkspaceMlConfig,
): UseWorkspaceResult {
  // 시퀀스가 한 번만 시작되도록 가드(StrictMode 이펙트 2회 실행 방지).
  const hasStartedRef = useRef(false);
  // 경로별 debounce FS 동기화기(1회 생성).
  const fileSyncRef = useRef<FileSync | null>(null);
  if (fileSyncRef.current === null) fileSyncRef.current = createFileSync();
  // 파일 델타 영속(IndexedDB) debounce 타이머. 최신 파일 버퍼는 ref로 읽는다.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesRef = useRef<ProjectFiles>(template);
  // 활성 파일 경로를 ref로 미러링 — 삭제/이름변경 콜백에서 최신 활성 파일을 동기로 읽는다.
  const activePathRef = useRef<string>('');

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

  // ML 평가(성능 점수) 상태. 중복 실행은 ref로 가드한다.
  const [evalResult, setEvalResult] = useState<MlEvalResult | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalErrorMessage, setEvalErrorMessage] = useState<string | null>(null);
  const isRunningEvalRef = useRef(false);

  // 브라우저 콘솔(미리보기 앱)에서 postMessage로 받은 console.*/에러 항목.
  const [consoleEntries, setConsoleEntries] = useState<BrowserConsoleEntry[]>([]);
  const clearConsole = useCallback(() => setConsoleEntries([]), []);

  // 백엔드 실시간 모니터 — API 로그(요청/응답) + DB 상태(db.json watch).
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const clearApiLogs = useCallback(() => setApiLogs([]), []);
  const [dbState, setDbState] = useState<unknown>(null);
  // dev 출력에서 API 로그 센티넬을 추출할 때 청크 경계에 걸친 조각을 모으는 버퍼.
  const devLogBufferRef = useRef('');
  // API 로그 항목에 부여하는 단조 증가 id(렌더 key).
  const apiLogIdRef = useRef(0);

  const lockedSet = useMemo(() => new Set(lockedPaths), [lockedPaths]);
  const isPathLocked = useCallback((path: string) => lockedSet.has(path), [lockedSet]);

  // 백엔드 API 요청 콘솔 설정 — 템플릿에서 백엔드 유무를 추론하고(없으면 null), 라우트 목록은
  // 라이브 파일에서 파싱해 합친다(학생이 라우트를 추가하면 Swagger식 목록이 즉시 갱신).
  const apiConsole = useMemo<ApiConsoleConfig | null>(() => {
    const base = inferApiConsoleConfig(template);
    if (!base) return null;
    const endpoints = parseEndpoints(files);
    return { ...base, endpoints, dataPath: pickDataPath(endpoints, base.defaultPath) };
  }, [template, files]);

  // 백엔드 포트는 apiConsole(라이브 파일로 매 편집 재계산)에서 떼어내 안정값으로 쓴다 —
  // sendApiRequest/resetData가 편집마다 재생성돼 콜백 신원이 흔들리는 것을 막는다(백엔드 없으면 null).
  const apiPort = apiConsole?.port ?? null;

  // 데이터 상태 뷰가 보여줄 컬렉션 경로를 ref로 미러링 — 콜백(refreshApiData)을 안정 신원으로
  // 유지하면서도 최신 dataPath를 읽는다(apiConsole은 편집마다 새 객체라 deps에 넣으면 불안정).
  const dataPathRef = useRef<string>('');
  useEffect(() => {
    dataPathRef.current = apiConsole?.dataPath ?? '';
  }, [apiConsole]);

  // 데이터 상태 뷰(테이블) 상태 — 컬렉션 조회 결과. API 호출로 데이터가 바뀌면 갱신된다.
  const [apiData, setApiData] = useState<ApiConsoleResponse | null>(null);
  const [isApiDataLoading, setIsApiDataLoading] = useState(false);

  // 데이터 상태 뷰 갱신 — 컬렉션 경로를 GET해 현재 데이터를 받아온다(백엔드 없으면 no-op).
  const refreshApiData = useCallback(async () => {
    if (apiPort === null || dataPathRef.current.length === 0) return;
    setIsApiDataLoading(true);
    try {
      const result = await sendHttpRequest({
        method: 'GET',
        path: dataPathRef.current,
        port: apiPort,
      });
      setApiData(result);
    } finally {
      setIsApiDataLoading(false);
    }
  }, [apiPort]);

  // 컨테이너 안에서 백엔드로 요청을 보낸다(콘솔 'Send'). 백엔드 없으면 ok:false로 안내.
  // 변경 요청(GET 외)이 성공적으로 도달하면 데이터 상태 뷰를 자동 갱신해 변화를 보여준다.
  const sendApiRequest = useCallback(
    async (request: ApiConsoleRequest): Promise<ApiConsoleResponse> => {
      if (apiPort === null) {
        return {
          ok: false,
          durationMs: 0,
          error: '이 워크스페이스에는 백엔드 API가 없습니다.',
        };
      }
      const result = await sendHttpRequest({ ...request, port: apiPort });
      if (result.ok && request.method.toUpperCase() !== 'GET') {
        void refreshApiData();
      }
      return result;
    },
    [apiPort, refreshApiData],
  );

  const appendLog = useCallback((chunk: string) => {
    setLogs((prev) => [...prev, chunk]);
  }, []);

  // dev 서버 출력을 받아 API 로그 센티넬(__DESPY_LOG__…__DESPY_LOG_END__)을 구조화 로그로
  // 분리하고, 나머지 텍스트는 콘솔(appendLog)로 흘린다. 청크가 센티넬 중간에서 잘릴 수 있어
  // 미완 조각은 버퍼에 남겨 다음 청크와 합친다(concurrently의 [api] 프리픽스·ANSI는 센티넬
  // 밖이라 콘솔로 흘러가고 JSON 파싱에 영향 없다).
  const handleDevOutput = useCallback(
    (chunk: string) => {
      let buffer = devLogBufferRef.current + chunk;
      let plain = '';
      for (;;) {
        const start = buffer.indexOf(API_LOG_PREFIX);
        if (start === -1) {
          plain += buffer;
          buffer = '';
          break;
        }
        plain += buffer.slice(0, start);
        const end = buffer.indexOf(API_LOG_SUFFIX, start);
        if (end === -1) {
          buffer = buffer.slice(start); // 미완 — 다음 청크를 기다린다
          break;
        }
        const json = buffer.slice(start + API_LOG_PREFIX.length, end);
        buffer = buffer.slice(end + API_LOG_SUFFIX.length);
        try {
          const parsed = JSON.parse(json) as Omit<ApiLogEntry, 'id'>;
          const entry: ApiLogEntry = { ...parsed, id: (apiLogIdRef.current += 1) };
          setApiLogs((prev) => {
            const next = [...prev, entry];
            return next.length > MAX_API_LOG_ENTRIES
              ? next.slice(next.length - MAX_API_LOG_ENTRIES)
              : next;
          });
        } catch {
          /* 깨진 로그 줄은 무시 */
        }
      }
      devLogBufferRef.current = buffer;
      if (plain) appendLog(plain);
    },
    [appendLog],
  );

  // 현재 파일 버퍼를 ref로 미러링해, debounce 후 영속 시점에 최신 델타를 계산한다.
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // 활성 파일 경로를 ref로 미러링(삭제/이름변경 후 활성 파일 보정용).
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // 미리보기(앱)가 보낸 콘솔 메시지를 수신해 누적한다(PREVIEW_CONSOLE_SCRIPT → postMessage).
  // 출처는 data.source 서명으로만 가른다(미리보기는 별 출처라 origin 화이트리스트 불가).
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as
        | { source?: unknown; level?: unknown; message?: unknown }
        | null;
      if (!data || data.source !== 'despy-console' || typeof data.message !== 'string') {
        return;
      }
      const level: BrowserConsoleLevel =
        data.level === 'info' ||
        data.level === 'warn' ||
        data.level === 'error' ||
        data.level === 'debug'
          ? data.level
          : 'log';
      setConsoleEntries((prev) => {
        const next = [...prev, { level, message: data.message as string, timestamp: Date.now() }];
        return next.length > MAX_CONSOLE_ENTRIES
          ? next.slice(next.length - MAX_CONSOLE_ENTRIES)
          : next;
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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

  // 빈 새 파일을 생성하고 즉시 연다(버퍼 + FS). 이미 있으면 열기만, 잠금 경로면 무시.
  // 부모 디렉토리는 FS 동기화 시 자동으로 mkdir된다(fileSync.writeWorkspaceFile).
  const createFile = useCallback(
    (path: string) => {
      if (!path || lockedSet.has(path)) return;
      if (filesRef.current[path] !== undefined) {
        setActivePath(path); // 이미 존재하면 내용 보존 — 열기만 한다
        return;
      }
      const next = { ...filesRef.current, [path]: '' };
      filesRef.current = next;
      setFiles(next);
      fileSyncRef.current?.schedule(path, '');
      scheduleFileDeltaPersist();
      setActivePath(path);
    },
    [lockedSet, scheduleFileDeltaPersist, setActivePath],
  );

  // 파일 또는 폴더(경로 프리픽스) 전체를 삭제한다(버퍼 + FS). 잠금 파일은 보호를 위해
  // 삭제 대상에서 제외한다. 열려 있던 파일이 사라지면 다른 파일로 전환한다.
  const deletePath = useCallback(
    (path: string) => {
      if (!path) return;
      const prefix = `${path}/`;
      const affected = Object.keys(filesRef.current).filter(
        (candidate) => candidate === path || candidate.startsWith(prefix),
      );
      const deletable = affected.filter((candidate) => !lockedSet.has(candidate));
      if (deletable.length === 0) return;

      const next = { ...filesRef.current };
      for (const candidate of deletable) {
        delete next[candidate];
        fileSyncRef.current?.cancel(candidate); // 대기 중인 쓰기가 파일을 되살리지 않도록
      }
      filesRef.current = next;
      setFiles(next);

      // FS에서도 제거한다(개별 — 폴더에 잠금 파일이 남아 있을 수 있어 폴더 일괄 rm은 피한다).
      for (const candidate of deletable) {
        void removeWorkspacePath(candidate).catch((error) =>
          logger.error('[useWorkspace] 파일 삭제 실패', candidate, error),
        );
      }
      scheduleFileDeltaPersist();

      if (deletable.includes(activePathRef.current)) {
        setActivePath(pickDefaultActivePath(next, lockedPaths));
      }
    },
    [lockedSet, lockedPaths, scheduleFileDeltaPersist, setActivePath],
  );

  // 파일/폴더 경로를 변경(이동)한다 — 폴더면 하위 전체 경로를 함께 remap한다.
  // 잠금 파일이 포함되면(경로가 바뀌면 잠금 매칭이 깨지므로) 거부하고, 대상 경로가
  // 이미 존재하면(충돌) 덮어쓰기를 막기 위해 중단한다.
  const renamePath = useCallback(
    (fromPath: string, toPath: string) => {
      if (!fromPath || !toPath || fromPath === toPath) return;
      const prefix = `${fromPath}/`;
      const affected = Object.keys(filesRef.current).filter(
        (candidate) => candidate === fromPath || candidate.startsWith(prefix),
      );
      if (affected.length === 0) return;
      if (affected.some((candidate) => lockedSet.has(candidate))) return;

      const remap = (candidate: string) =>
        candidate === fromPath ? toPath : `${toPath}${candidate.slice(fromPath.length)}`;

      const next = { ...filesRef.current };
      if (affected.some((candidate) => next[remap(candidate)] !== undefined)) return;

      for (const candidate of affected) {
        next[remap(candidate)] = next[candidate];
        delete next[candidate];
        fileSyncRef.current?.cancel(candidate);
      }
      filesRef.current = next;
      setFiles(next);

      void renameWorkspacePath(fromPath, toPath).catch((error) =>
        logger.error('[useWorkspace] 경로 변경 실패', fromPath, toPath, error),
      );
      scheduleFileDeltaPersist();

      if (affected.includes(activePathRef.current)) {
        setActivePath(remap(activePathRef.current));
      }
    },
    [lockedSet, scheduleFileDeltaPersist, setActivePath],
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

  // ML 평가 — 숨긴 test셋을 주입하고 evalCommand를 실행해 성능 지표를 회수한다.
  // 평가 직전에 현재 편집 버퍼를 FS에 다시 mount해 최신 model.mjs가 반영되게 하고,
  // 이어서 testFiles를 additive mount한다(학생 편집분 위에 얹혀 덮어쓸 수 없음). seed는
  // env(DESPY_SEED)로 주입해 재현성을 확보한다.
  const runEvaluation = useCallback(async (): Promise<MlEvalResult | null> => {
    if (!mlConfig) return null;
    if (isRunningEvalRef.current) {
      throw new Error('평가가 이미 실행 중입니다.');
    }
    isRunningEvalRef.current = true;
    setIsRunningEval(true);
    setEvalErrorMessage(null);
    appendLog('[despy] 숨겨진 test셋 주입 + 평가 실행 중…\n');

    try {
      // 최신 편집분을 FS에 반영(debounce 대기 중인 쓰기가 있어도 평가에 반영되게).
      await mountProjectFiles(filesRef.current);
      // 숨긴 test셋을 채점 시점에만 주입(학생 파일트리에 노출되지 않음).
      await mountProjectFiles(mlConfig.testFiles);

      const [command, ...args] = mlConfig.spec.evalCommand.split(' ').filter(Boolean);
      const outcome = await runScoreEval(command ?? 'node', args, {
        onOutput: appendLog,
        timeoutMs: ML_EVAL_TIMEOUT_MS,
        env: { DESPY_SEED: String(mlConfig.spec.seed) },
      });

      if (!outcome.ok || !outcome.result) {
        const message = outcome.error ?? '평가에 실패했습니다.';
        setEvalErrorMessage(message);
        appendLog(`[despy] 평가 실패: ${message}\n`);
        return null;
      }
      setEvalResult(outcome.result);
      appendLog(
        `[despy] 평가 완료 — ${outcome.result.metric} ${outcome.result.value}\n`,
      );
      return outcome.result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEvalErrorMessage(message);
      appendLog(`[despy] 평가 실패: ${message}\n`);
      logger.error('[useWorkspace] 평가 실행 실패', error);
      return null;
    } finally {
      isRunningEvalRef.current = false;
      setIsRunningEval(false);
    }
  }, [mlConfig, appendLog]);

  const start = useCallback(async () => {
    try {
      // 재진입 여부를 확인한다 — 재진입이면 WebContainer가 이미 살아 있으므로
      // 부팅·npm install을 건너뛰고 dev 서버만 재시작해 빠르게 워크스페이스를 복구한다.
      const isReentry = isContainerBooted();
      if (isReentry) {
        killDevServer();
      }

      // 세션을 resetSession으로 이미 지웠으므로 restored는 항상 undefined(undefined=템플릿).
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
      if (restored?.activePath && initialFiles[restored.activePath] !== undefined) {
        setActivePathState(restored.activePath);
      }

      if (!isReentry) {
        setPhase('booting');
        appendLog('[despy] WebContainer 부팅 중…\n');
      }
      await bootWebContainer();

      // 미리보기 콘솔 브리지 설치(앱 console.*/에러 → 부모로 중계). dev 서버보다 먼저
      // 호출해 앱 코드 실행 전에 가로채기가 걸리게 한다. 실패해도 워크스페이스는 계속.
      try {
        await installPreviewConsoleBridge();
      } catch (bridgeError) {
        logger.error('[useWorkspace] 미리보기 콘솔 브리지 설치 실패', bridgeError);
      }

      setPhase('mounting');
      appendLog('[despy] 프로젝트 파일 mount 중…\n');
      await mountProjectFiles(initialFiles);

      if (!isReentry) {
        setPhase('installing');
        appendLog('[despy] npm install 실행 중… (최초 1회는 수십 초 걸릴 수 있습니다)\n');
        const installExitCode = await runCommand('npm', ['install'], appendLog);
        if (installExitCode !== 0) {
          throw new Error(`npm install 실패 (exit ${installExitCode}).`);
        }
      }

      // ML 챌린지는 dev 서버(미리보기)가 없다 — install 후 바로 준비 완료로 두고,
      // 학생이 model.mjs를 수정한 뒤 '성능 점수' 탭의 평가를 실행하게 한다.
      if (mlConfig) {
        setPreviewUrl(null);
        setPhase('ready');
        appendLog(
          '[despy] ML 워크스페이스 준비 완료 — model.mjs를 수정하고 성능 점수 탭에서 평가하세요.\n',
        );
        return;
      }

      setPhase('starting');
      appendLog('[despy] npm run dev 시작…\n');
      // 풀스택 템플릿은 프론트·백 두 포트가 server-ready를 내므로 프론트 포트만 골라
      // 미리보기를 확정한다(단일 서버 템플릿은 previewPort=undefined → 첫 이벤트로 확정).
      const { url } = await startDevServer('npm', ['run', 'dev'], {
        onOutput: handleDevOutput,
        previewPort: inferPreviewPort(template),
      });

      setPreviewUrl(url);
      setPhase('ready');
      appendLog(`[despy] 미리보기 준비 완료 → ${url}\n`);
      // 백엔드가 있으면 데이터 상태 뷰(테이블)를 첫 로드한다(없으면 no-op).
      void refreshApiData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setPhase('error');
      logger.error('[useWorkspace] 워크스페이스 시작 실패', error);
    }
  }, [template, challengeId, appendLog, handleDevOutput, refreshApiData, mlConfig]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (challengeId && !hasHydrated) return;

    // 페이지 진입마다 세션을 초기화한다 — AI 사용량·파일 편집이 모두 리셋된다.
    // "한 번 벗어나면 시험 종료"이므로 이전 상태를 이어갈 이유가 없다.
    if (challengeId) useWorkspaceStore.getState().resetSession(challengeId);

    hasStartedRef.current = true;
    queueMicrotask(() => void start());
  }, [start, challengeId, hasHydrated]);

  // DB 상태 라이브 뷰 — 워크스페이스 준비 후 db.json을 watch해 변경 시 dbState를 갱신한다.
  // 파일 백업 db를 쓰는 백엔드 템플릿(apiConsole.dbFilePath)에서만 동작한다.
  useEffect(() => {
    const dbFilePath = apiConsole?.dbFilePath;
    if (phase !== 'ready' || !dbFilePath) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void watchContainerFile(dbFilePath, (content) => {
      if (cancelled) return;
      if (content === null) {
        setDbState(null);
        return;
      }
      try {
        setDbState(JSON.parse(content));
      } catch {
        setDbState(null);
      }
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [phase, apiConsole]);

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

  // 데이터 초기화 — 인메모리 저장소는 dev 서버 프로세스 안에 있으므로, 서버를 재시작해야
  // 초기 상태로 돌아간다(파일은 이미 FS에 동기화돼 있어 재mount 없이 재시작만 한다).
  const resetData = useCallback(async () => {
    if (apiPort === null) return;
    killDevServer();
    setPreviewUrl(null);
    setPhase('starting');
    appendLog('[despy] 데이터 초기화 — dev 서버 재시작 중…\n');
    try {
      const { url } = await startDevServer('npm', ['run', 'dev'], {
        onOutput: appendLog,
        previewPort: inferPreviewPort(template),
      });
      setPreviewUrl(url);
      setPhase('ready');
      appendLog('[despy] 데이터 초기화 완료 — 서버가 초기 상태로 재시작됐습니다.\n');
      // 초기 상태로 돌아간 데이터를 다시 읽어 테이블을 갱신한다.
      void refreshApiData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setPhase('error');
      logger.error('[useWorkspace] 데이터 초기화(재시작) 실패', error);
    }
  }, [apiPort, appendLog, template, refreshApiData]);

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
    createFile,
    deletePath,
    renamePath,
    isPathLocked,
    runTests,
    testResult,
    isRunningTests,
    testErrorMessage,
    runEvaluation,
    evalResult,
    isRunningEval,
    evalErrorMessage,
    consoleEntries,
    clearConsole,
    apiConsole,
    sendApiRequest,
    apiLogs,
    clearApiLogs,
    dbState,
    apiData,
    isApiDataLoading,
    refreshApiData,
    resetData,
    questionsUsed,
    tokensUsed,
    recordAiTurn,
  };
}
