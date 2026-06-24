/**
 * mlScore.test.ts — ML 지표 판정·환산 + ML 최종 점수 가중합 단위 테스트
 *
 * ML 챌린지 채점의 객관 축(성능 점수)은 공정성의 핵심이므로, metric 방향(accuracy ≥ /
 * rmse ≤)에 따른 합격 판정과 [0,1] 환산(게이지·가중합용), 그리고 computeFinalScore의
 * ML 객관 비율 대체(objectiveRatioOverride) 경계를 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import {
  isMlPassing,
  mlScoreRatio,
  formatMlValue,
  mlMetricMeta,
} from './mlScore';
import { computeFinalScore } from './score';
import type { AutoTestResult, RubricGradingResult } from '@/shared/core/types';

const emptyAutoTest: AutoTestResult = { passedCount: 0, totalCount: 0, cases: [] };

const rubricHalf: RubricGradingResult = {
  scores: [],
  totalScore: 5,
  maxScore: 10,
  feedback: '',
};

describe('isMlPassing', () => {
  it('accuracy는 임계값 이상이면 합격(높을수록 좋음)', () => {
    expect(isMlPassing('accuracy', 0.9, 0.85)).toBe(true);
    expect(isMlPassing('accuracy', 0.85, 0.85)).toBe(true); // 경계 포함
    expect(isMlPassing('accuracy', 0.84, 0.85)).toBe(false);
  });

  it('rmse는 임계값 이하면 합격(낮을수록 좋음)', () => {
    expect(isMlPassing('rmse', 5, 8)).toBe(true);
    expect(isMlPassing('rmse', 8, 8)).toBe(true); // 경계 포함
    expect(isMlPassing('rmse', 9, 8)).toBe(false);
  });

  it('유한수가 아니면(NaN·Infinity) 불합격', () => {
    expect(isMlPassing('accuracy', NaN, 0.85)).toBe(false);
    expect(isMlPassing('rmse', Infinity, 8)).toBe(false);
  });
});

describe('mlScoreRatio', () => {
  it('accuracy는 값 자체를 [0,1]로 클램프', () => {
    expect(mlScoreRatio('accuracy', 0.92, 0.85)).toBeCloseTo(0.92);
    expect(mlScoreRatio('accuracy', 1.5, 0.85)).toBe(1); // 상한
    expect(mlScoreRatio('accuracy', -0.2, 0.85)).toBe(0); // 하한
  });

  it('rmse는 임계값/값으로 환산하고 1로 상한(임계값 도달 시 1)', () => {
    expect(mlScoreRatio('rmse', 8, 8)).toBeCloseTo(1); // 임계값 = 1.0
    expect(mlScoreRatio('rmse', 16, 8)).toBeCloseTo(0.5); // 두 배 나쁨
    expect(mlScoreRatio('rmse', 4, 8)).toBe(1); // 더 좋아도 상한 1
    expect(mlScoreRatio('rmse', 0, 8)).toBe(1); // 완벽
  });

  it('유한수가 아니면 0', () => {
    expect(mlScoreRatio('accuracy', NaN, 0.85)).toBe(0);
  });
});

describe('formatMlValue / mlMetricMeta', () => {
  it('accuracy는 백분율, rmse는 소수 3자리', () => {
    expect(formatMlValue('accuracy', 0.9234)).toBe('92.3%');
    expect(formatMlValue('rmse', 5.0262)).toBe('5.026');
  });

  it('metric 방향 메타데이터', () => {
    expect(mlMetricMeta('accuracy').higherIsBetter).toBe(true);
    expect(mlMetricMeta('rmse').higherIsBetter).toBe(false);
  });
});

describe('computeFinalScore — ML 객관 비율 대체', () => {
  const weights = { tests: 0.6, rubric: 0.4 };

  it('objectiveRatioOverride가 testsRatio 자리에 들어간다(루브릭 축 유지)', () => {
    // accuracy 0.9 → 객관 0.9 · 비중 0.6 = 0.54, 루브릭 0.5 · 0.4 = 0.2 → 0.74 → 74
    const ratio = mlScoreRatio('accuracy', 0.9, 0.85);
    const score = computeFinalScore(emptyAutoTest, rubricHalf, weights, ratio);
    expect(score).toBe(74);
  });

  it('rmse도 환산 비율로 동일하게 가중합된다', () => {
    // rmse 16, 임계값 8 → 환산 0.5 · 0.6 = 0.3, 루브릭 0.5 · 0.4 = 0.2 → 0.5 → 50
    const ratio = mlScoreRatio('rmse', 16, 8);
    const score = computeFinalScore(emptyAutoTest, rubricHalf, weights, ratio);
    expect(score).toBe(50);
  });

  it('override가 없으면 기존 자동 테스트 통과율을 쓴다(워크스페이스 과제 회귀 방지)', () => {
    const autoTest: AutoTestResult = {
      passedCount: 2,
      totalCount: 4,
      cases: [],
    };
    // testsRatio 0.5 · 0.6 = 0.3, 루브릭 0.5 · 0.4 = 0.2 → 0.5 → 50
    expect(computeFinalScore(autoTest, rubricHalf, weights)).toBe(50);
  });
});
