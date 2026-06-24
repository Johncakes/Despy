/**
 * route.ts (/api/judge) — 채점 프록시 (Judge0)
 *
 * 학생 제출 코드를 Judge0로 보내 격리 실행·채점한다. CORS 회피와 인증 토큰
 * 은닉을 위해 브라우저가 직접 Judge0를 호출하지 않고 이 라우트를 경유한다.
 *
 * 폴백: JUDGE0_URL이 설정되지 않으면 실제 실행 대신 모의(mock) 결과를 반환해
 * 앱 플로우를 즉시 체험할 수 있게 한다(isMock=true). Judge0 인스턴스를 띄우고
 * .env.local에 JUDGE0_URL을 넣으면 자동으로 실제 채점으로 전환된다.
 * (로컬 셋업: docs/judge0.md)
 *
 * 사용처: shared/core/api/judgeApi (학생 제출)
 */
import type {
  GradingRequest,
  GradingResult,
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '@/shared/core/types';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

// ── Judge0 응답 타입 (필요한 필드만) ─────────────────────────────────────────

interface Judge0Token {
  token: string;
}

interface Judge0SubmissionResult {
  token: string;
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  /** 실행 시간(초) — 문자열 */
  time?: string | null;
  /** 메모리(KB) */
  memory?: number | null;
}

// Judge0 status.id 매핑: 3=Accepted, 4=Wrong Answer, 5=Time Limit Exceeded
const JUDGE0_POLL_INTERVAL_MS = 700;
const JUDGE0_MAX_POLLS = 20;

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as GradingRequest;
  const judge0Url = process.env.JUDGE0_URL?.replace(/\/$/, '');

  try {
    const result = judge0Url
      ? await gradeWithJudge0(body, judge0Url)
      : mockGrade(body);
    return Response.json(result);
  } catch (error) {
    logger.error('채점 실패', error);
    const message = error instanceof Error ? error.message : '채점 중 오류가 발생했습니다.';
    return new Response(message, { status: 502 });
  }
}

// ── Judge0 실제 채점 ──────────────────────────────────────────────────────────

async function gradeWithJudge0(
  req: GradingRequest,
  baseUrl: string,
): Promise<GradingResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authToken = process.env.JUDGE0_AUTH_TOKEN;
  if (authToken) headers['X-Auth-Token'] = authToken;

  const submissions = req.testCases.map((testCase) => ({
    source_code: req.sourceCode,
    language_id: req.judge0LanguageId,
    stdin: testCase.input,
    expected_output: testCase.expectedOutput,
    cpu_time_limit: req.timeLimitSec,
    memory_limit: req.memoryLimitMb * 1024,
  }));

  // 1) 배치 제출 → 토큰 수집
  const submitResponse = await fetch(
    `${baseUrl}/submissions/batch?base64_encoded=false&wait=false`,
    { method: 'POST', headers, body: JSON.stringify({ submissions }) },
  );
  if (!submitResponse.ok) {
    throw new Error(`Judge0 제출 실패 (${submitResponse.status})`);
  }
  const tokenObjects = (await submitResponse.json()) as Judge0Token[];
  const tokens = tokenObjects.map((item) => item.token).join(',');

  // 2) 모든 제출이 끝날 때까지 폴링
  const fields = 'token,status,stdout,stderr,compile_output,time,memory';
  let results: Judge0SubmissionResult[] = [];
  for (let attempt = 0; attempt < JUDGE0_MAX_POLLS; attempt += 1) {
    const pollResponse = await fetch(
      `${baseUrl}/submissions/batch?tokens=${tokens}&base64_encoded=false&fields=${fields}`,
      { headers },
    );
    if (!pollResponse.ok) {
      throw new Error(`Judge0 조회 실패 (${pollResponse.status})`);
    }
    const data = (await pollResponse.json()) as {
      submissions: Judge0SubmissionResult[];
    };
    results = data.submissions;
    // status.id 1=In Queue, 2=Processing → 아직 진행 중
    const stillRunning = results.some((item) => (item.status?.id ?? 1) <= 2);
    if (!stillRunning) break;
    await delay(JUDGE0_POLL_INTERVAL_MS);
  }

  const caseResults: TestCaseResult[] = req.testCases.map((testCase, index) => {
    const raw = results[index];
    const statusId = raw?.status?.id ?? 0;
    const status = mapJudge0Status(statusId);
    return buildCaseResult(testCase, status, {
      actualOutput: raw?.stdout ?? undefined,
      stderr: raw?.stderr ?? raw?.compile_output ?? undefined,
      timeSec: raw?.time ? Number(raw.time) : undefined,
      memoryKb: raw?.memory ?? undefined,
    });
  });

  return summarize(req, caseResults, false);
}

// ── 모의 채점 (JUDGE0_URL 미설정 시) ──────────────────────────────────────────

function mockGrade(req: GradingRequest): GradingResult {
  const hasCode = req.sourceCode.trim().length > 0;
  const caseResults: TestCaseResult[] = req.testCases.map((testCase) => {
    const status: TestCaseStatus = hasCode ? 'passed' : 'error';
    return buildCaseResult(testCase, status, {
      actualOutput: hasCode ? testCase.expectedOutput : '',
      stderr: hasCode ? undefined : '코드가 비어 있습니다 (모의 채점).',
      timeSec: 0,
      memoryKb: 0,
    });
  });
  return summarize(req, caseResults, true);
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

/** 비공개 케이스는 input/expected/actual을 가려서 케이스 결과를 만든다. */
function buildCaseResult(
  testCase: TestCase,
  status: TestCaseStatus,
  detail: Pick<TestCaseResult, 'actualOutput' | 'stderr' | 'timeSec' | 'memoryKb'>,
): TestCaseResult {
  const base: TestCaseResult = {
    testCaseId: testCase.id,
    isPublic: testCase.isPublic,
    status,
    timeSec: detail.timeSec,
    memoryKb: detail.memoryKb,
  };
  if (!testCase.isPublic) return base;
  return {
    ...base,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    actualOutput: detail.actualOutput,
    stderr: detail.stderr,
  };
}

function summarize(
  req: GradingRequest,
  caseResults: TestCaseResult[],
  isMock: boolean,
): GradingResult {
  return {
    problemId: req.problemId,
    languageId: req.languageId,
    totalCount: caseResults.length,
    passedCount: caseResults.filter((item) => item.status === 'passed').length,
    caseResults,
    isMock,
    submittedAt: Date.now(),
  };
}

function mapJudge0Status(statusId: number): TestCaseStatus {
  switch (statusId) {
    case 3:
      return 'passed';
    case 4:
      return 'failed';
    case 5:
      return 'timeout';
    default:
      return 'error';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
