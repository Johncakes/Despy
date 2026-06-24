/**
 * index.ts — 공유 도메인 타입 단일 출처 (배럴)
 *
 * 여러 레이어에서 공유되는 도메인 타입을 이곳에 단일 출처로 정의한다.
 * despy의 핵심 도메인: 문제(Problem) · AI 정책(AiPolicy) · 테스트 케이스(TestCase) ·
 * 채점 결과(GradingResult) · AI 대화 사용량(AgentUsage).
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
