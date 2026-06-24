/**
 * score.test.ts — 채점 정규화·가중합 단위 테스트
 *
 * 점수 무결성의 핵심 로직이므로, LLM 출력의 범위 밖/누락/잘못된 항목 보정과
 * weights 가중합·분모 0 경계를 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import { normalizeRubricResult, computeFinalScore } from './score';
import type { AutoTestResult, GradingRubric } from '@/shared/core/types';

const rubric: GradingRubric = {
  criteria: [
    { id: 'c1', description: '삭제 동작', maxScore: 10 },
    { id: 'c2', description: '예외 처리', maxScore: 5 },
  ],
  weights: { tests: 0.6, rubric: 0.4 },
};

describe('normalizeRubricResult', () => {
  it('점수를 항목 만점 범위로 클램프한다', () => {
    const result = normalizeRubricResult(
      {
        scores: [
          { criterionId: 'c1', score: 99, reason: '초과' },
          { criterionId: 'c2', score: -3, reason: '음수' },
        ],
        feedback: '총평',
      },
      rubric,
    );
    expect(result.scores[0].score).toBe(10); // 99 → 10
    expect(result.scores[1].score).toBe(0); // -3 → 0
    expect(result.totalScore).toBe(10);
    expect(result.maxScore).toBe(15);
  });

  it('누락된 항목은 0점 처리하고 점수 출처는 루브릭이다', () => {
    const result = normalizeRubricResult(
      { scores: [{ criterionId: 'c1', score: 8, reason: 'ok' }], feedback: '' },
      rubric,
    );
    expect(result.scores).toHaveLength(2);
    expect(result.scores[1].criterionId).toBe('c2');
    expect(result.scores[1].score).toBe(0);
  });

  it('루브릭에 없는 임의 항목은 무시한다', () => {
    const result = normalizeRubricResult(
      {
        scores: [{ criterionId: 'ghost', score: 100, reason: '허위' }],
        feedback: '',
      },
      rubric,
    );
    expect(result.scores.every((s) => s.criterionId !== 'ghost')).toBe(true);
    expect(result.totalScore).toBe(0);
  });
});

describe('computeFinalScore', () => {
  const fullRubric = normalizeRubricResult(
    {
      scores: [
        { criterionId: 'c1', score: 10, reason: '' },
        { criterionId: 'c2', score: 5, reason: '' },
      ],
      feedback: '',
    },
    rubric,
  );

  it('테스트 통과율과 루브릭 점수율을 weights로 가중합한다', () => {
    const autoTest: AutoTestResult = { passedCount: 2, totalCount: 4, cases: [] };
    // tests 50% * 0.6 + rubric 100% * 0.4 = 0.7 → 70
    expect(computeFinalScore(autoTest, fullRubric, rubric.weights)).toBe(70);
  });

  it('분모 0(테스트 없음)은 0%로 처리한다', () => {
    const autoTest: AutoTestResult = { passedCount: 0, totalCount: 0, cases: [] };
    // tests 0% * 0.6 + rubric 100% * 0.4 = 0.4 → 40
    expect(computeFinalScore(autoTest, fullRubric, rubric.weights)).toBe(40);
  });

  it('만점이면 100', () => {
    const autoTest: AutoTestResult = { passedCount: 4, totalCount: 4, cases: [] };
    expect(computeFinalScore(autoTest, fullRubric, rubric.weights)).toBe(100);
  });
});
