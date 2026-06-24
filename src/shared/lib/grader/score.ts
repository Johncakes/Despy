/**
 * score.ts — 채점 점수 정규화·가중합 (순수 함수, 모델 비의존)
 *
 * LLM이 돌려준 항목별 점수를 루브릭 만점 범위로 클램프해 신뢰 가능한
 * `RubricGradingResult`로 정규화하고(normalizeRubricResult), 자동 테스트 통과율과
 * 루브릭 점수를 weights로 가중합해 0~100 최종 점수를 계산한다(computeFinalScore).
 * LLM 출력(잘못된 criterionId·범위 밖 점수·누락)을 방어적으로 보정해 점수 무결성을 지킨다.
 *
 * 레이어 규칙: 외부 의존 없는 순수 로직. shared/core 타입만 참조.
 *
 * 사용처: shared/lib/grader/geminiGrader(정규화), app/api/grade(가중합)
 */
import type {
  AutoTestResult,
  GradingResult,
  GradingRubric,
  RubricGradingResult,
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/** LLM이 돌려주는 원시 채점 출력(정규화 전). totalScore/maxScore는 서버가 계산한다. */
export interface RawRubricScores {
  scores: { criterionId: string; score: number; reason: string }[];
  feedback: string;
}

/** LLM이 돌려주는 알고리즘 채점 원시 출력(정규화 전). 통과 수는 서버가 집계한다. */
export interface RawAlgorithmScores {
  cases: {
    testCaseId: string;
    status: TestCaseStatus;
    actualOutput?: string;
    reason?: string;
  }[];
  feedback: string;
}

// ── 정규화 ───────────────────────────────────────────────────────────────────

/**
 * LLM 원시 점수를 루브릭 기준으로 정규화한다.
 * - 점수 출처는 루브릭의 criteria(LLM이 만든 임의 항목이 아니라).
 * - 각 항목 점수는 [0, maxScore]로 클램프하고, 누락 항목은 0점 처리한다.
 * - totalScore/maxScore는 LLM 합산을 신뢰하지 않고 서버에서 직접 합산한다.
 */
export function normalizeRubricResult(
  raw: RawRubricScores,
  rubric: GradingRubric,
): RubricGradingResult {
  const scores = rubric.criteria.map((criterion) => {
    const found = raw.scores.find((item) => item.criterionId === criterion.id);
    const rawScore = found?.score ?? 0;
    const clamped = clamp(rawScore, 0, criterion.maxScore);
    return {
      criterionId: criterion.id,
      score: clamped,
      reason: found?.reason ?? '(채점 근거 없음)',
    };
  });

  const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
  const maxScore = rubric.criteria.reduce(
    (sum, criterion) => sum + criterion.maxScore,
    0,
  );

  return { scores, totalScore, maxScore, feedback: raw.feedback };
}

/**
 * LLM 원시 알고리즘 채점을 테스트케이스 기준으로 정규화한다.
 * - 결과 출처는 출제된 testCases(LLM이 만든 임의 케이스가 아니라).
 * - 케이스별 status는 LLM 출력에서 찾되, 누락·미지원 값은 'error'로 보정한다.
 * - 비공개 케이스는 input/expectedOutput을 결과에서 가린다(학생 노출 방지).
 * - passedCount는 LLM 합산을 신뢰하지 않고 서버에서 직접 집계한다.
 */
export function normalizeAlgorithmResult(
  raw: RawAlgorithmScores,
  testCases: TestCase[],
  meta: { problemId: string; languageId: string },
): GradingResult {
  const caseResults: TestCaseResult[] = testCases.map((testCase) => {
    const found = raw.cases.find((item) => item.testCaseId === testCase.id);
    const status = toValidStatus(found?.status);
    return {
      testCaseId: testCase.id,
      isPublic: testCase.isPublic,
      status,
      // 비공개 케이스는 입력/기대출력·근거를 결과에 노출하지 않는다(역추론 방지).
      input: testCase.isPublic ? testCase.input : undefined,
      expectedOutput: testCase.isPublic ? testCase.expectedOutput : undefined,
      actualOutput: testCase.isPublic ? found?.actualOutput : undefined,
      reason: testCase.isPublic ? found?.reason ?? '(채점 근거 없음)' : undefined,
    };
  });

  const passedCount = caseResults.filter((c) => c.status === 'passed').length;

  return {
    problemId: meta.problemId,
    languageId: meta.languageId,
    totalCount: caseResults.length,
    passedCount,
    caseResults,
    feedback: raw.feedback,
    submittedAt: Date.now(),
  };
}

// ── 가중합 ───────────────────────────────────────────────────────────────────

/**
 * 자동 테스트 통과율과 루브릭 점수율을 weights로 가중합한 0~100 최종 점수.
 * 분모 0(테스트/항목 없음)은 0%로 처리하고 정수로 반올림한다.
 */
export function computeFinalScore(
  autoTest: AutoTestResult,
  rubric: RubricGradingResult,
  weights: GradingRubric['weights'],
): number {
  const testsRatio =
    autoTest.totalCount > 0 ? autoTest.passedCount / autoTest.totalCount : 0;
  const rubricRatio =
    rubric.maxScore > 0 ? rubric.totalScore / rubric.maxScore : 0;

  const weighted = testsRatio * weights.tests + rubricRatio * weights.rubric;
  return Math.round(clamp(weighted, 0, 1) * 100);
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

const VALID_STATUSES: readonly TestCaseStatus[] = [
  'passed',
  'failed',
  'error',
  'timeout',
];

/** LLM이 돌려준 status가 유효 상태가 아니면(누락·오타) 'error'로 보정한다. */
function toValidStatus(value: unknown): TestCaseStatus {
  return VALID_STATUSES.includes(value as TestCaseStatus)
    ? (value as TestCaseStatus)
    : 'error';
}
