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
  GradingRubric,
  RubricGradingResult,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/** LLM이 돌려주는 원시 채점 출력(정규화 전). totalScore/maxScore는 서버가 계산한다. */
export interface RawRubricScores {
  scores: { criterionId: string; score: number; reason: string }[];
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
