/**
 * index.ts — 공유 도메인 타입 단일 출처 (배럴)
 *
 * 여러 레이어에서 공유되는 도메인 타입을 이곳에 단일 출처로 정의한다.
 * despy의 핵심 도메인: 과제(ChallengeProblem) · 루브릭(GradingRubric) · 워크스페이스
 * 파일트리(ProjectFiles) · 종합 채점(ChallengeGradingResult) · AI 정책(AiPolicy) ·
 * AI 대화 사용량(AgentUsage) · 알고리즘 문제(Problem/TestCase/GradingResult).
 * 알고리즘 채점은 Judge0 실행에서 AI 정성 채점으로 교체되었다(P5, 2026-06-24) —
 * 코드를 실행하지 않고 AI가 테스트케이스 기준으로 정답성을 판정한다.
 * feature 전용 타입은 해당 feature 폴더에 두고, 공유되는 것만 여기로 승격한다.
 *
 * 사용처: features/*, shared/* 전반 (`@/shared/core/types`)
 */

// ── 워크스페이스 (WebContainer) ─────────────────────────────────────────────

/**
 * WebContainer가 mount하는 프로젝트 파일트리.
 *
 * 경로→파일 내용의 평면 맵으로 보관하고(`{ 'src/App.jsx': '...', 'package.json': '...' }`),
 * 런타임(`shared/lib/webcontainer/runtime.ts`)에서 WebContainer의 중첩 구조
 * (FileSystemTree)로 변환해 mount한다. 평면 맵이 출제·편집·diff에 다루기 쉽다.
 *
 * (docs/spec-webcontainer.md §4.1)
 */
export type ProjectFiles = Record<string, string>;

// ── 과제(Challenge) — WebContainer 피벗 모델 ───────────────────────────────
//
// 알고리즘 표준입출력(Problem/TestCase)과 나란히 존재하는 실무형 웹 과제 모델이다.
// 교수가 시작 파일트리·잠금경로·테스트·루브릭·AI정책을 출제하고, 학생은
// WebContainer 워크스페이스에서 풀이한 뒤 자동 테스트 + AI 루브릭으로 채점받는다.
// (docs/spec-webcontainer.md §4)

/**
 * 채점 레벨 anchor. 한 루브릭 항목 안에서 "이 점수를 받는 조건"을 못박는 서술자다.
 * 정의되면 AI 점수는 이 레벨 값 중 하나로 스냅되어(score.ts), 레벨 서술자가 곧
 * 점수의 근거가 된다(점수 6과 7을 가르는 즉흥적 경계 대신 정의된 기준으로 채점).
 */
export interface RubricLevel {
  /** 이 레벨에서 부여하는 점수(0 ~ 항목 만점) */
  score: number;
  /** 이 점수를 받는 조건 서술자(예: "모든 예외를 처리") */
  descriptor: string;
}

/**
 * 채점 루브릭 항목. AI 정성 채점의 단위 기준이다(예: "장바구니가 비었을 때 예외 처리").
 */
export interface RubricCriterion {
  id: string;
  /** 채점 항목 설명 */
  description: string;
  /** 이 항목 만점 */
  maxScore: number;
  /**
   * 점수 레벨 anchor(선택). 정의되면 AI는 이 레벨 중 하나를 골라야 하고, 정규화가
   * 점수를 가장 가까운 레벨로 스냅한다. 비면 기존대로 [0, maxScore] 자유 점수.
   */
  levels?: RubricLevel[];
  /** 배점·기준 근거 메모(선택). 왜 이 배점·기준인지에 대한 출제자 정당화. */
  rationale?: string;
}

/**
 * 과제 채점 루브릭. 자동 테스트 통과율과 AI 루브릭 점수를 weights로 가중합한다(합 1.0).
 */
export interface GradingRubric {
  criteria: RubricCriterion[];
  /** 최종 점수 가중치 (tests + rubric = 1.0) */
  weights: {
    /** 자동 테스트 통과율 비중 */
    tests: number;
    /** AI 루브릭 점수 비중 */
    rubric: number;
  };
}

// ── ML 챌린지 (TensorFlow.js) ──────────────────────────────────────────────
//
// 워크스페이스 과제와 같은 인프라(파일트리·제출·AI 채팅)를 재활용하되, "숨긴 test셋에
// 대한 모델 성능"을 객관 지표로 채점하는 ML 전용 챌린지다. ChallengeProblem에 판별자
// (kind)와 선택 필드(ml)를 얹어 확장한다(별도 store/타입 분리 대신 — docs/spec-ml-challenge.md §4).
// 학생은 브라우저 WebContainer에서 pure @tensorflow/tfjs로 모델을 작성·학습하고, 제출 시
// 컨테이너가 숨긴 test셋을 주입·평가해 점수 센티넬(__DESPY_SCORE__)로 회수한다.

/** 과제 종류 판별자. 기존 워크스페이스 과제는 'workspace', ML 챌린지는 'ml'. */
export type ChallengeKind = 'workspace' | 'ml';

/**
 * ML 평가지표. 'accuracy'는 분류(0~1, 높을수록 좋음), 'rmse'는 회귀(≥0, 낮을수록 좋음).
 * 합격 판정 방향(≥/≤)·표시 형식·게이지는 metric에서 파생한다(shared/lib/grader/mlScore.ts).
 */
export type MlMetric = 'accuracy' | 'rmse';

/**
 * ML 챌린지 전용 설정 — kind === 'ml'일 때만 존재한다.
 *
 * 숨긴 test 데이터(testDataPath)는 ChallengeProblem.testFiles에 담겨 학생에게 노출되지
 * 않고, 제출(채점) 시점에만 컨테이너 FS에 주입된다. seed 고정으로 동일 코드의 점수 변동을
 * 제거해 공정성을 확보한다(완벽한 무결성은 아님 — 한계는 UI에 명시, §7).
 */
export interface MlSpec {
  /** 평가지표 — 분류 정확도 또는 회귀 RMSE */
  metric: MlMetric;
  /** 합격 임계값 (accuracy면 ≥ 이 값, rmse면 ≤ 이 값) */
  passThreshold: number;
  /** 재현성을 위한 고정 seed (점수 변동성 제거) */
  seed: number;
  /** 학생 노출 train 데이터 경로(template 파일트리 내, 예: 'data/train.csv') */
  trainDataPath: string;
  /** 채점 시점에만 주입하는 숨긴 test 데이터 경로(testFiles에 포함, 예: 'data/test.csv') */
  testDataPath: string;
  /** 점수 센티넬을 출력하는 평가 진입점 (예: 'node eval.mjs') */
  evalCommand: string;
}

/**
 * 컨테이너 평가 실행의 원시 결과 — eval 스크립트가 __DESPY_SCORE__ 센티넬로 출력하고
 * runtime.runScoreEval이 파싱한다. value는 metric의 원시 지표값(정확도 0~1 또는 RMSE).
 */
export interface MlEvalResult {
  metric: MlMetric;
  value: number;
}

/**
 * ML 성능 채점 결과 — 컨테이너가 숨긴 test셋으로 산출한 객관 점수와 합격 여부.
 * 정성(루브릭) 점수와 함께 ChallengeGradingResult에 담겨 최종 점수로 가중합된다.
 */
export interface MlGradingResult {
  metric: MlMetric;
  /** 컨테이너가 계산한 원시 지표값(정확도 0~1 또는 RMSE) */
  value: number;
  /** 합격 임계값(MlSpec.passThreshold) */
  passThreshold: number;
  /** metric 방향(accuracy ≥ / rmse ≤)에 따른 임계값 합격 여부 */
  passed: boolean;
}

/**
 * 과제(Challenge). 교수가 출제하는 실무형 웹 과제의 단일 출처다.
 *
 * template은 학생에게 주어지는 시작 파일트리(주어진 백엔드/API 포함), testFiles는
 * 채점용 테스트(학생 비노출, 제출 시점에 주입). 채점 무결성을 위해 공식 점수는
 * 서버(/api/grade)가 testFiles로 재실행해 산출한다(§7.2).
 *
 * kind === 'ml'이면 ML 챌린지로, ml(MlSpec)이 채워지고 채점이 성능 지표(객관)+루브릭(정성)
 * 2축이 된다. 워크스페이스 필드(template·testFiles·devCommand 등)는 ML도 그대로 재활용한다.
 */
export interface ChallengeProblem {
  id: string;
  title: string;
  /** 마크다운 지문 (요구사항·시나리오) */
  statement: string;

  /** 과제 종류 판별자(기존 데이터는 'workspace'로 migrate). */
  kind: ChallengeKind;
  /** ML 챌린지 전용 설정 — kind === 'ml'일 때만 존재. */
  ml?: MlSpec;

  // ── 워크스페이스 ──
  /** 학생에게 주어지는 시작 파일트리 (주어진 백엔드/API 포함) */
  template: ProjectFiles;
  /** 학생이 편집할 수 없는 경로(주어진 API·골격). 에디터 read-only */
  lockedPaths: string[];
  /** 학생 주 작업 영역 경로(강조 표시용, 비면 lockedPaths의 보수) */
  editablePaths: string[];

  // ── 실행 명령 ──
  setupCommands: string[]; // 예: ['npm install']
  devCommand: string; // 예: 'npm run dev'
  testCommand: string; // 예: 'npm test'

  // ── 채점 ──
  /** 채점용 테스트 파일트리(학생 비노출, 제출 시점에 FS에 주입) */
  testFiles: ProjectFiles;
  /** AI 정성 채점 기준 */
  rubric: GradingRubric;

  // ── AI 통제 (기존 재활용) ──
  aiPolicy: AiPolicy;

  // ── 서버 영속 (M4) ──
  /** 출제자(교수) id = AuthUser.id. 서버 영속(M4) 도입 필드. 클라 전환 중 optional, 서버는 항상 채운다. */
  authorId?: string;
  /** 출제 상태. 학생에겐 'published'만 노출. M4 도입 — 클라 전환 중 optional, 서버는 항상 채운다. */
  status?: ChallengeStatus;

  createdAt: number;
  updatedAt: number;
}

/** 과제 출제 상태. 학생 목록/조회는 'published'만 노출한다. */
export type ChallengeStatus = 'draft' | 'published' | 'archived';

/**
 * 학생 풀이 화면에 내려가는 과제 DTO (서버가 ChallengeDoc에서 매핑).
 *
 * rubric(채점 기준)은 항상 제거한다 — 채점은 서버가 저장된 과제로 확정한다.
 * testFiles(숨긴 test셋)는 워크스페이스 과제에선 제거하지만, **ML 과제는 클라이언트
 * 성능평가(runEvaluation)에 필요해 interim으로 노출한다**(ML 서버평가는 후속 — 결정 A,
 * docs/spec-ml-challenge.md §5·§8). 이때 ml도 full MlSpec이다.
 *
 * ⚠️ aiPolicy.systemPrompt는 **아직 유지**한다 — 클라이언트 AiChatPanel이 /api/agent로
 *    직접 주입하기 때문이다. systemPrompt 서버 주입(클라 비노출)은 M5(민감정보 서버화)에서
 *    /api/agent가 저장된 과제에서 로드하도록 분리한다.
 */
export interface StudentChallenge {
  id: string;
  title: string;
  statement: string;
  kind: ChallengeKind;
  /** ML 과제 전용 — 클라 성능평가용 full MlSpec(interim). 워크스페이스 과제엔 없음. */
  ml?: MlSpec;
  /** ML 과제 전용 — 클라 성능평가용 숨긴 test셋(interim). 워크스페이스 과제엔 없음. */
  testFiles?: ProjectFiles;
  template: ProjectFiles;
  lockedPaths: string[];
  editablePaths: string[];
  setupCommands: string[];
  devCommand: string;
  testCommand: string;
  /** AI 정책. systemPrompt 포함(M5에서 서버 주입으로 분리 예정 — 위 ⚠️ 참조). */
  aiPolicy: AiPolicy;
  authorId: string;
  status: ChallengeStatus;
  createdAt: number;
  updatedAt: number;
}

/** 과제 생성/수정 입력 — 서버가 채우는 식별/상태/시각 필드를 제외한 출제 내용. */
export type ChallengeInput = Omit<
  ChallengeProblem,
  'id' | 'authorId' | 'status' | 'createdAt' | 'updatedAt'
>;

/**
 * 과제 목록 표시용 공통 필드(역할별 DTO의 교집합).
 * 홈·출제 목록의 카드는 이 필드들만 쓰므로, 학생(StudentChallenge)·교수(ChallengeProblem)
 * 어느 응답이든 이 형태로 받아 다룬다.
 */
export interface ChallengeSummary {
  id: string;
  title: string;
  statement: string;
  kind: ChallengeKind;
  status?: ChallengeStatus;
  authorId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 자동 테스트(WebContainer 내 실행) 결과. 풀이 중엔 클라이언트 즉시 피드백용,
 * 공식 점수는 서버 재실행 결과를 신뢰한다(§7.2).
 */
export interface AutoTestResult {
  passedCount: number;
  totalCount: number;
  cases: { name: string; passed: boolean; message?: string }[];
}

/**
 * API 요청 콘솔이 보내는 단일 요청(백엔드가 있는 워크스페이스 전용).
 *
 * 호스트에서 WebContainer 미리보기로 직접 fetch하면 CORS/COEP에 막히므로, 이 요청은
 * 컨테이너 *안에서* 실행해 같은 컨테이너 localhost의 백엔드로 보낸다(useWorkspace.sendApiRequest).
 */
export interface ApiConsoleRequest {
  /** HTTP 메서드(GET·POST·PUT·PATCH·DELETE). */
  method: string;
  /** 요청 경로(쿼리 포함 가능, 예: '/api/todos'). */
  path: string;
  /** 요청 바디(JSON 문자열). GET 등 바디 없는 요청은 비운다. */
  body?: string;
}

/** API 요청 콘솔 응답 — 컨테이너 안에서 실행한 HTTP 결과. */
export interface ApiConsoleResponse {
  /** 요청이 응답까지 도달했는지(false면 error에 사유). 상태코드와 무관. */
  ok: boolean;
  status?: number;
  statusText?: string;
  /** 요청 시작~응답 종료까지 경과(ms). */
  durationMs: number;
  headers?: Record<string, string>;
  /** 응답 바디(원문 문자열). */
  body?: string;
  /** 네트워크/실행 오류 메시지(요청 자체가 실패한 경우). */
  error?: string;
}

/**
 * API 요청 콘솔 설정 — 백엔드가 있는 워크스페이스에만 주어진다(없으면 null).
 *
 * useWorkspace가 템플릿에서 추론해 노출하고, WorkspacePanel이 콘솔 탭 표시 여부와
 * 초기 입력값·기본 탭을 정하는 데 쓴다.
 */
export interface ApiConsoleConfig {
  /** 백엔드가 listen하는 컨테이너 내부 포트(예: 3000). */
  port: number;
  /** 경로 입력의 초기값(템플릿별 best-effort, 예: '/api/todos'·'/todos'). */
  defaultPath: string;
  /** 미리보기(프론트)가 없어 콘솔이 주 화면인지(백엔드 단독 → true). */
  isPrimaryView: boolean;
  /**
   * DB 상태 뷰가 watch할 저장소 파일 경로(컨테이너 루트 상대, 예: 'server/data/db.json').
   * 백엔드 템플릿이 파일 백업 db를 쓸 때만 주어진다. 없으면 DB 탭을 숨긴다.
   */
  dbFilePath?: string;
  /**
   * 백엔드 소스에서 추론한 라우트 목록(Swagger식 목록·요청 프리필용).
   * 라이브 파일 기준으로 갱신되므로 학생이 라우트를 추가하면 즉시 반영된다.
   */
  endpoints: ApiEndpoint[];
  /**
   * 데이터 상태 뷰가 호출해 보여줄 컬렉션 조회 경로(첫 무파라미터 GET, 없으면 defaultPath).
   * API 호출로 데이터가 어떻게 변하는지 이 경로의 응답으로 확인한다.
   */
  dataPath: string;
}

/**
 * 백엔드 소스에서 추론한 단일 라우트 — API 콘솔의 Swagger식 목록 한 줄.
 *
 * Express 라우트 정의(app.get('/todos', …) 등)를 정규식으로 best-effort 파싱한 결과다.
 * 클릭하면 콘솔 요청 바에 메서드·경로가 채워진다.
 */
export interface ApiEndpoint {
  /** HTTP 메서드(대문자, 예: 'GET'·'POST'). */
  method: string;
  /** 라우트 경로(파라미터 포함 가능, 예: '/todos'·'/todos/:id'). */
  path: string;
}

/**
 * 백엔드가 처리한 HTTP 요청 1건의 실시간 로그(API 로그 패널 표시용).
 *
 * 잠긴 서버 진입점에 주입된 로깅 미들웨어가 매 요청을 센티넬 JSON으로 stdout에 출력하고,
 * useWorkspace가 dev 출력 스트림에서 그 줄을 파싱해 만든다. 콘솔 수동 요청뿐 아니라
 * 프론트(풀스택)가 보낸 요청까지 모두 잡힌다.
 */
export interface ApiLogEntry {
  /** 클라이언트가 부여하는 고유 id(렌더 key·정렬용 — 서버가 아니라 호스트가 채운다). */
  id: number;
  method: string;
  path: string;
  status: number;
  /** 서버 처리 소요(ms). */
  durationMs: number;
  /** 요청 바디(파싱된 값, 없으면 생략). */
  reqBody?: unknown;
  /** 응답 바디(직렬화된 값, 없으면 생략). */
  resBody?: unknown;
}

/**
 * AI 루브릭 채점(Gemini, 구조화 출력) 결과.
 */
export interface RubricGradingResult {
  scores: { criterionId: string; score: number; reason: string }[];
  totalScore: number;
  maxScore: number;
  feedback: string;
}

/**
 * 종합 채점 결과 — 자동 테스트 + AI 루브릭을 weights로 가중합한 최종 점수.
 *
 * ML 챌린지(kind === 'ml')는 객관 축이 자동 테스트(autoTest) 대신 성능 지표(ml)다.
 * 이때 finalScore는 성능 지표율을 tests 가중치 자리에 넣어 루브릭과 가중합한다(score.ts).
 */
export interface ChallengeGradingResult {
  problemId: string;
  autoTest: AutoTestResult;
  rubric: RubricGradingResult;
  /** ML 챌린지 성능 채점 결과(객관). 워크스페이스 과제면 생략. */
  ml?: MlGradingResult;
  /**
   * 채점에 쓰인 가중치(tests·rubric). 학생 결과 패널은 rubric을 갖지 않으므로(서버 채점)
   * 점수 분해율 표시를 위해 결과에 함께 담는다. 구버전 결과엔 없을 수 있어 선택.
   */
  weights?: GradingRubric['weights'];
  /**
   * 채점 기준 항목(설명·만점). 결과 패널이 criterionId를 사람이 읽는 라벨로 매핑하는 데 쓴다.
   * 구버전 결과엔 없을 수 있어 선택.
   */
  rubricCriteria?: RubricCriterion[];
  /** weights로 가중합한 최종 점수(0~100) */
  finalScore: number;
  submittedAt: number;
}

// ── 제출 (Submission) — 서버 영속 (M4) ────────────────────────────────────────

/** AI 대화 1턴(제출 기록에 보관) — 학생 프롬프트 또는 AI 응답. */
export interface SubmissionPromptTurn {
  role: 'user' | 'assistant';
  /** 학생 프롬프트는 코드 첨부분을 제외한 질문만, AI 응답은 본문 텍스트. */
  text: string;
  /**
   * user 턴 한정 — 이 프롬프트를 작성한 시점의 코드 상태(템플릿 대비 변경 파일 델타).
   * 대시보드가 연속 스냅샷을 비교해 "프롬프트가 만든 변경점(diff)"을 보여준다.
   * assistant 턴·구버전 기록엔 없을 수 있어 선택.
   */
  filesAtSend?: ProjectFiles;
}

/**
 * 제출 1건 (서버 도메인) — 과제 채점 결과 + 제출자 식별 + 제출 코드·프롬프트 스냅샷.
 *
 * 교수 채점 대시보드(GradingDashboardView)의 데이터 소스다. 식별은 인증된 userId
 * (=AuthUser.id)로 하며, studentName은 제출 시점 표시용 스냅샷일 뿐 신원으로 신뢰하지
 * 않는다(M4 — 자유텍스트 studentName 신원을 대체).
 */
export interface Submission {
  id: string;
  challengeId: string;
  /** 제출 학생 id = AuthUser.id (소유권·접근 통제의 기준). */
  userId: string;
  /** 제출 시점 AuthUser.name 스냅샷(표시용, 신원 신뢰 X). */
  studentName: string;
  /** 공식 채점 결과(서버 /api/grade 확정). */
  result: ChallengeGradingResult;
  /** 제출 시 학생이 변경한 코드(경로→내용). 구버전 기록엔 없을 수 있어 선택. */
  submittedFiles?: ProjectFiles;
  /** 제출 시점까지의 AI 대화(프롬프트+응답). 구버전 기록엔 없을 수 있어 선택. */
  prompts?: SubmissionPromptTurn[];
  /** 제출 시점 AI 사용량(질문 횟수·누적 토큰). */
  aiUsage?: { questionsUsed: number; tokensUsed: number };
  /** 시험 감독 로그 — 탭 이탈·외부 붙여넣기·전체화면 이탈 카운트. */
  integrityLog?: IntegrityLog;
  /** 제출 시각(ms). */
  createdAt: number;
}

/**
 * 제출 생성 요청 (학생 → POST /api/challenges/[challengeId]/submissions).
 *
 * 서버가 **저장된 과제의 rubric**으로 채점하므로 클라이언트는 채점 기준(rubric·systemPrompt)을
 * 보내지 않는다(무결성 — 클라가 보낸 점수/기준 불신뢰). 객관 신호(autoTest 또는 mlScore)와
 * 제출 코드·대화·사용량·감독 로그만 보낸다.
 */
export interface ChallengeSubmitRequest {
  /** 학생이 변경한 파일(경로→내용). */
  submittedFiles: ProjectFiles;
  /** WebContainer 자동 테스트 결과(참고 신호). ML 챌린지는 빈 결과. */
  autoTest: AutoTestResult;
  /** ML 챌린지 성능 점수(객관) — 컨테이너가 숨긴 test셋으로 계산한 지표값 + 임계값. */
  mlScore?: { metric: MlMetric; value: number; passThreshold: number };
  /** 선택: 템플릿 대비 변경 diff. */
  diff?: string;
  /** 제출 시점까지의 AI 대화(프롬프트+응답 스냅샷). */
  prompts?: SubmissionPromptTurn[];
  /** 제출 시점 AI 사용량. */
  aiUsage?: { questionsUsed: number; tokensUsed: number };
  /** 시험 감독 로그. */
  integrityLog?: IntegrityLog;
}

/**
 * 과제 채점 요청 페이로드 (클라이언트 → /api/grade).
 *
 * 학생 제출 파일·루브릭과 풀이 중 본 자동테스트 결과(참고 신호)를 묶는다.
 * 공식 점수는 서버가 루브릭 정성 채점 + 가중합으로 확정한다(docs/spec-webcontainer.md §7.2).
 * autoTest는 *즉시 피드백*일 뿐이며 점수 무결성은 서버가 책임진다.
 */
export interface ChallengeGradingRequest {
  problemId: string;
  /** 과제 요구사항 마크다운 (채점 맥락) */
  statement: string;
  /** 채점 기준(항목·만점·가중치) */
  rubric: GradingRubric;
  /** 학생이 제출한(변경한) 파일 — 경로→내용 평면 맵 */
  submittedFiles: ProjectFiles;
  /** 선택: 템플릿 대비 변경 diff */
  diff?: string;
  /** WebContainer 자동 테스트 결과 (참고 신호) */
  autoTest: AutoTestResult;
  /**
   * ML 챌린지 성능 점수(객관) — 컨테이너가 숨긴 test셋으로 계산한 지표값 + 합격 임계값.
   * kind === 'ml' 제출에만 담긴다. 서버는 이를 신뢰해 passed 판정 + 최종 점수에 반영한다
   * (MVP — 컨테이너 계산 신뢰, 서버 재실행은 후속. docs/spec-ml-challenge.md §5·§8).
   */
  mlScore?: { metric: MlMetric; value: number; passThreshold: number };
  /** 채점 모델 id (미지정 시 서버 기본값) */
  model?: string;
  /** 채점 가드레일 시스템 프롬프트 (교수 설정) */
  systemPrompt?: string;
}

// ── 언어 ────────────────────────────────────────────────────────────────

/**
 * 지원 프로그래밍 언어. Monaco 에디터 언어 모드와 AI 채점 맥락(언어 표시명)에 쓰인다.
 */
export interface SupportedLanguage {
  /** 내부 식별자 (예: 'python') */
  id: string;
  /** 사용자 표시명 (예: 'Python 3') */
  label: string;
  /** Monaco 에디터 언어 모드 (예: 'python') */
  monacoLanguage: string;
  /** 에디터 초기 코드 스니펫 */
  defaultCode: string;
}

// ── 문제 / 정책 ───────────────────────────────────────────────────────────

/**
 * 테스트 케이스. isPublic=false면 학생 화면에서 입력/기대출력을 가린다.
 */
export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  /** 학생에게 공개 여부 (비공개 케이스는 풀이 화면에서 내용 숨김) */
  isPublic: boolean;
}

/**
 * AI 에이전트 정책 — 교수가 설정하고 학생은 변경할 수 없는 가드레일.
 *
 * MVP에서는 localStorage에 저장되어 systemPrompt가 클라이언트에 노출되지만,
 * 모델 고정·질문 횟수·토큰 한도라는 통제 의도 자체는 동일하게 강제한다.
 */
export interface AiPolicy {
  /** 고정 모델 id (예: 'gemini-2.5-flash') — 학생 변경 불가 */
  model: string;
  /** 문제당 최대 질문 횟수 */
  maxQuestions: number;
  /** 문제당 최대 누적 토큰(입력+출력) 한도 */
  maxTokens: number;
  /** 답변 가드레일 시스템 프롬프트 (학생 비노출 의도) */
  systemPrompt: string;
}

/**
 * 알고리즘 문제. 교수가 출제하며 학생 풀이 화면의 단일 출처가 된다.
 */
export interface Problem {
  id: string;
  title: string;
  /** 마크다운 지문 */
  statement: string;
  inputFormat: string;
  outputFormat: string;
  timeLimitSec: number;
  memoryLimitMb: number;
  /** 풀이 시 선택 가능한 SupportedLanguage.id 목록 */
  allowedLanguageIds: string[];
  testCases: TestCase[];
  aiPolicy: AiPolicy;
  createdAt: number;
  updatedAt: number;
}

// ── 채점 (알고리즘 — AI 정성 채점) ──────────────────────────────────────────
//
// 알고리즘 채점은 코드를 실행(Judge0)하는 대신 AI가 테스트케이스 기준으로 정답성을
// 판정한다(P5, 2026-06-24). 실행이 아닌 추론이라 정답성·엣지케이스는 근사이며,
// 시간/메모리 초과(timeSec/memoryKb)는 측정 불가다. 무결성 한계는 UI에 명시한다.

/** 단일 테스트 케이스 채점 상태. AI 채점은 주로 passed/failed/error를 사용한다. */
export type TestCaseStatus = 'passed' | 'failed' | 'error' | 'timeout';

/**
 * 케이스별 채점 결과. 비공개 케이스는 input/expected/actual을 생략해 표시한다.
 * AI 채점에서는 actualOutput이 AI가 추정한 출력, reason이 통과/실패 판단 근거다.
 */
export interface TestCaseResult {
  testCaseId: string;
  isPublic: boolean;
  status: TestCaseStatus;
  input?: string;
  expectedOutput?: string;
  /** AI가 추정한 실행 출력 (실제 실행 결과가 아님) */
  actualOutput?: string;
  /** AI 채점 판단 근거 (한국어) */
  reason?: string;
  stderr?: string;
}

/**
 * 제출 1건의 종합 채점 결과(알고리즘).
 */
export interface GradingResult {
  problemId: string;
  /** 채점에 사용한 SupportedLanguage.id */
  languageId: string;
  totalCount: number;
  passedCount: number;
  caseResults: TestCaseResult[];
  /** 학생에게 줄 종합 피드백 (한국어) */
  feedback: string;
  submittedAt: number;
}

/**
 * 알고리즘 채점 요청 페이로드 (클라이언트 → /api/grade/algorithm).
 * AI가 정답성을 판정하므로 실행 환경(language_id)이 아니라 채점 맥락(지문·언어·
 * 테스트케이스)을 보낸다.
 */
export interface GradingRequest {
  problemId: string;
  languageId: string;
  /** 문제 지문 마크다운 (채점 맥락) */
  statement: string;
  sourceCode: string;
  testCases: TestCase[];
  /** 채점 모델 id (미지정 시 서버 기본값) */
  model?: string;
  /** 채점 가드레일 시스템 프롬프트 (교수 설정) */
  systemPrompt?: string;
}

// ── 인증 / 사용자 (실서비스 전환 — JWT + MongoDB) ──────────────────────────────
//
// MVP에는 인증이 없었으나 실서비스 전환을 위해 이메일/비밀번호 + JWT 인증과
// 역할 기반 접근(RBAC)을 도입한다. 신원은 인증으로 확인하고, 권한(무엇을 할 수
// 있나)은 role로 결정한다. (docs/spec-production-v1.md)

/**
 * 사용자 역할. 신규 가입자는 기본 'student'이며, 관리자가 'professor'로 승격한다.
 * - student: 풀이·제출·본인 결과 조회
 * - professor: 출제·AI정책·채점 대시보드 (본인 출제분)
 * - admin: 전체 사용자/역할 관리
 */
export type UserRole = 'student' | 'professor' | 'admin';

/**
 * 클라이언트에 노출되는 안전한 사용자 표현 — passwordHash 등 민감 필드를 제외한다.
 * 서버 DB의 UserDoc(shared/lib/db/users.ts)에서 이 형태로만 직렬화해 응답한다.
 */
export interface AuthUser {
  /** UserDoc._id 문자열 */
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// ── AI 사용량 ──────────────────────────────────────────────────────────────

/**
 * AI 응답에 첨부되는 토큰 사용량 메타데이터.
 * /api/agent가 toUIMessageStreamResponse의 messageMetadata로 내려보내고,
 * 클라이언트는 이를 누적해 남은 토큰을 계산한다.
 */
export interface AgentUsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ── 시험 감독 (Proctoring) ───────────────────────────────────────────────────
//
// 학생이 풀이 화면을 벗어나거나 외부 내용을 붙여넣는 행위를 감지·카운트한 결과.
// useProctoringMonitor(shared/lib/hooks)가 생성하고, 과제 제출 시 StoredSubmission에
// 첨부되어 교수 대시보드에서 사후 분석된다. 데이터 타입이라 core에 둔다(core→lib 금지).

/**
 * 시험 감독 로그 — 탭 이탈·외부 붙여넣기·전체화면 이탈 카운트.
 *
 * ⚠️ 억제(deterrence) 수준의 지표다. 개발자도구·다른 기기로 우회 가능하며
 *    확실한 차단은 Electron 앱이 필요하다(docs/spec-anti-cheating.md 참조).
 */
export interface IntegrityLog {
  /** visibilitychange(hidden) 감지 횟수 */
  tabSwitchCount: number;
  /** 탭이 숨겨진 누적 시간(ms) */
  tabSwitchTotalMs: number;
  /** 30자 초과 붙여넣기 횟수 — 앱 내부 자기복사/외부 유입을 구분하지 못하는 약신호 */
  externalPasteCount: number;
  /** 전체화면 이탈 횟수(전체화면 진입 후 나간 경우만 카운트) */
  fullscreenExitCount: number;
}
