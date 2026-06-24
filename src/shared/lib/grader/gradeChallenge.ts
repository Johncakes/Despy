/**
 * gradeChallenge.ts — 과제 종합 채점 (서버 전용 헬퍼)
 *
 * 루브릭 정성 채점(grader) + 객관 축(자동 테스트 통과율 또는 ML 성능 지표)을 weights로
 * 가중합해 ChallengeGradingResult를 산출한다. /api/grade와 제출 생성
 * (/api/challenges/[challengeId]/submissions)이 공유해 채점 로직 중복을 없애고 점수 산출을
 * 서버 한 곳에 모은다.
 *
 * ⚠️ 무결성: rubric·systemPrompt는 호출부가 **저장된 과제(서버 DB)** 에서 로드해 넘긴다 —
 *    클라이언트가 보낸 채점 기준은 신뢰하지 않는다.
 *
 * 사용처: app/api/grade, app/api/challenges/[challengeId]/submissions (서버 전용)
 */
import { grader } from './index';
import { computeFinalScore } from './score';
import { isMlPassing, mlScoreRatio } from './mlScore';
import type {
  AutoTestResult,
  ChallengeGradingResult,
  GradingRubric,
  MlGradingResult,
  MlMetric,
  ProjectFiles,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GradeChallengeInput {
  problemId: string;
  statement: string;
  rubric: GradingRubric;
  submittedFiles: ProjectFiles;
  diff?: string;
  autoTest: AutoTestResult;
  /** ML 챌린지 성능 점수(객관). 워크스페이스 과제면 생략. */
  mlScore?: { metric: MlMetric; value: number; passThreshold: number };
  /** 채점 모델 id (미지정 시 grader 기본값). */
  model?: string;
  /** 채점 가드레일 시스템 프롬프트(선택). 없으면 grader 기본 채점 프롬프트. */
  systemPrompt?: string;
}

// ── 채점 ───────────────────────────────────────────────────────────────────

/**
 * 과제 제출을 종합 채점한다. 루브릭 정성 채점 → (ML이면 성능 지표를 객관 축으로 환산) →
 * 가중합으로 0~100 최종 점수를 확정한다. 채점기 호출은 throw될 수 있어 호출부가 502로 변환한다.
 */
export async function gradeChallengeSubmission(
  input: GradeChallengeInput,
): Promise<ChallengeGradingResult> {
  const rubricResult = await grader.gradeRubric({
    statement: input.statement,
    rubric: input.rubric,
    submittedFiles: input.submittedFiles,
    diff: input.diff,
    autoTest: input.autoTest,
    model: input.model ?? '',
    systemPrompt: input.systemPrompt,
  });

  // ML 챌린지면 성능 점수(객관)를 최종 점수의 객관 축으로 환산해 가중합에 넣고, metric
  // 방향에 따른 합격 여부를 결과에 담는다. 워크스페이스 과제면 자동 테스트 통과율이 객관 축.
  let ml: MlGradingResult | undefined;
  let objectiveRatioOverride: number | undefined;
  if (input.mlScore) {
    const { metric, value, passThreshold } = input.mlScore;
    ml = {
      metric,
      value,
      passThreshold,
      passed: isMlPassing(metric, value, passThreshold),
    };
    objectiveRatioOverride = mlScoreRatio(metric, value, passThreshold);
  }

  const finalScore = computeFinalScore(
    input.autoTest,
    rubricResult,
    input.rubric.weights,
    objectiveRatioOverride,
  );

  return {
    problemId: input.problemId,
    autoTest: input.autoTest,
    rubric: rubricResult,
    ml,
    // 학생 결과 패널이 rubric 없이도 정확한 점수 분해·항목 라벨을 그릴 수 있도록 결과에 담는다.
    weights: input.rubric.weights,
    rubricCriteria: input.rubric.criteria,
    finalScore,
    submittedAt: Date.now(),
  };
}
