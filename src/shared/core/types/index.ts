/**
 * index.ts — 공유 도메인 타입 단일 출처 (배럴)
 *
 * 여러 레이어에서 공유되는 도메인 타입을 이곳에 단일 출처로 정의한다.
 * despy의 핵심 도메인: 과제(ChallengeProblem) · 루브릭(GradingRubric) · 워크스페이스
 * 파일트리(ProjectFiles) · 종합 채점(ChallengeGradingResult) · AI 정책(AiPolicy) ·
 * AI 대화 사용량(AgentUsage). 구 알고리즘 모델(Problem/TestCase/GradingResult/
 * GradingRequest)은 P5 정리 단계에서 제거 예정이다(피벗 — docs/spec-webcontainer.md).
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
// 알고리즘 표준입출력(Problem/TestCase/GradingRequest)을 대체하는 실무형 웹 과제
// 모델이다. 교수가 시작 파일트리·잠금경로·테스트·루브릭·AI정책을 출제하고, 학생은
// WebContainer 워크스페이스에서 풀이한 뒤 자동 테스트 + AI 루브릭으로 채점받는다.
// (docs/spec-webcontainer.md §4) 구 Problem 계열은 P5 정리 단계에서 제거된다.

/**
 * 채점 루브릭 항목. AI 정성 채점의 단위 기준이다(예: "장바구니가 비었을 때 예외 처리").
 */
export interface RubricCriterion {
  id: string;
  /** 채점 항목 설명 */
  description: string;
  /** 이 항목 만점 */
  maxScore: number;
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

/**
 * 과제(Challenge). 교수가 출제하는 실무형 웹 과제의 단일 출처다.
 *
 * template은 학생에게 주어지는 시작 파일트리(주어진 백엔드/API 포함), testFiles는
 * 채점용 테스트(학생 비노출, 제출 시점에 주입). 채점 무결성을 위해 공식 점수는
 * 서버(/api/grade)가 testFiles로 재실행해 산출한다(§7.2).
 */
export interface ChallengeProblem {
  id: string;
  title: string;
  /** 마크다운 지문 (요구사항·시나리오) */
  statement: string;

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
 */
export interface ChallengeGradingResult {
  problemId: string;
  autoTest: AutoTestResult;
  rubric: RubricGradingResult;
  /** weights로 가중합한 최종 점수(0~100) */
  finalScore: number;
  submittedAt: number;
}

// ── 언어 ────────────────────────────────────────────────────────────────

/**
 * 지원 프로그래밍 언어. Judge0 채점과 Monaco 에디터 양쪽에 필요한 식별자를 묶는다.
 */
export interface SupportedLanguage {
  /** 내부 식별자 (예: 'python') */
  id: string;
  /** 사용자 표시명 (예: 'Python 3') */
  label: string;
  /** Judge0 language_id (채점 API 전송용) */
  judge0Id: number;
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

// ── 채점 ──────────────────────────────────────────────────────────────────

/** 단일 테스트 케이스 채점 상태 */
export type TestCaseStatus = 'passed' | 'failed' | 'error' | 'timeout';

/**
 * 케이스별 채점 결과. 비공개 케이스는 input/expected/actual을 생략해 표시한다.
 */
export interface TestCaseResult {
  testCaseId: string;
  isPublic: boolean;
  status: TestCaseStatus;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  stderr?: string;
  /** 실행 시간(초) */
  timeSec?: number;
  /** 메모리 사용량(KB) */
  memoryKb?: number;
}

/**
 * 제출 1건의 종합 채점 결과.
 */
export interface GradingResult {
  problemId: string;
  /** 채점에 사용한 SupportedLanguage.id */
  languageId: string;
  totalCount: number;
  passedCount: number;
  caseResults: TestCaseResult[];
  /** 실제 Judge0가 아닌 모의(mock) 채점이면 true */
  isMock: boolean;
  submittedAt: number;
}

/**
 * 채점 요청 페이로드 (클라이언트 → /api/judge).
 * Judge0가 요구하는 형태가 아닌, 우리 도메인 기준의 요청 형태다.
 */
export interface GradingRequest {
  problemId: string;
  languageId: string;
  /** Judge0 language_id */
  judge0LanguageId: number;
  sourceCode: string;
  timeLimitSec: number;
  memoryLimitMb: number;
  testCases: TestCase[];
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
