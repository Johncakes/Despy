/**
 * score.test.ts — 채점 정규화·가중합 단위 테스트
 *
 * 점수 무결성의 핵심 로직이므로, LLM 출력의 범위 밖/누락/잘못된 항목 보정과
 * weights 가중합·분모 0 경계를 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeRubricResult,
  computeFinalScore,
  normalizeAlgorithmResult,
} from './score';
import type { AutoTestResult, GradingRubric, TestCase } from '@/shared/core/types';

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

// AI 알고리즘 채점: status 집계·보정과 비공개 케이스 가림(역추론 방지)을 검증한다.
describe('normalizeAlgorithmResult', () => {
  const testCases: TestCase[] = [
    { id: 't1', input: '1 2', expectedOutput: '3', isPublic: true },
    { id: 't2', input: '비밀', expectedOutput: '비밀출력', isPublic: false },
  ];

  it('status를 직접 집계해 passedCount를 낸다(LLM 합산 불신)', () => {
    const result = normalizeAlgorithmResult(
      {
        cases: [
          { testCaseId: 't1', status: 'passed', actualOutput: '3', reason: 'ok' },
          { testCaseId: 't2', status: 'failed', reason: '틀림' },
        ],
        feedback: '총평',
      },
      testCases,
      { problemId: 'two-sum', languageId: 'python' },
    );
    expect(result.passedCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.feedback).toBe('총평');
  });

  it('누락·미지원 status는 error로 보정한다', () => {
    const result = normalizeAlgorithmResult(
      {
        cases: [{ testCaseId: 't1', status: 'wtf' as never, reason: '오타' }],
        feedback: '',
      },
      testCases,
      { problemId: 'p', languageId: 'python' },
    );
    expect(result.caseResults[0].status).toBe('error'); // 오타 → error
    expect(result.caseResults[1].status).toBe('error'); // 누락 → error
  });

  it('비공개 케이스는 input/expected/actual/reason을 가린다', () => {
    const result = normalizeAlgorithmResult(
      {
        cases: [
          { testCaseId: 't1', status: 'passed', actualOutput: '3', reason: '공개근거' },
          { testCaseId: 't2', status: 'passed', actualOutput: '비밀출력', reason: '비밀근거' },
        ],
        feedback: '',
      },
      testCases,
      { problemId: 'p', languageId: 'python' },
    );
    const [pub, priv] = result.caseResults;
    expect(pub.input).toBe('1 2');
    expect(pub.reason).toBe('공개근거');
    expect(priv.input).toBeUndefined();
    expect(priv.expectedOutput).toBeUndefined();
    expect(priv.actualOutput).toBeUndefined();
    expect(priv.reason).toBeUndefined();
    expect(priv.status).toBe('passed'); // 상태는 노출
  });
});

// LLM 출력·요청 페이로드가 망가져도 점수 함수가 NaN/크래시/범위 밖을 내지 않아야
// 하므로(점수 무결성), 경계·악성 입력을 직접 방어하는지 검증한다.
describe('점수 무결성 방어 케이스', () => {
  const fullRubricResult = normalizeRubricResult(
    {
      scores: [
        { criterionId: 'c1', score: 10, reason: '' },
        { criterionId: 'c2', score: 5, reason: '' },
      ],
      feedback: '',
    },
    rubric,
  );

  it('NaN 점수는 0으로 정규화한다', () => {
    const result = normalizeRubricResult(
      { scores: [{ criterionId: 'c1', score: NaN, reason: '비정상' }], feedback: '' },
      rubric,
    );
    expect(result.scores[0].score).toBe(0);
  });

  it('빈 루브릭은 분모 0이라 루브릭 기여가 0이다(크래시 없음)', () => {
    const emptyRubric: GradingRubric = {
      criteria: [],
      weights: { tests: 0.5, rubric: 0.5 },
    };
    const emptyResult = normalizeRubricResult({ scores: [], feedback: '' }, emptyRubric);
    const autoTest: AutoTestResult = { passedCount: 0, totalCount: 0, cases: [] };
    // tests 0% + rubric 0%(maxScore 0) → 0
    expect(computeFinalScore(autoTest, emptyResult, emptyRubric.weights)).toBe(0);
  });

  it('과가중(합>1) weights여도 최종 점수를 100으로 클램프한다', () => {
    const autoTest: AutoTestResult = { passedCount: 4, totalCount: 4, cases: [] };
    // 1*1 + 1*1 = 2 → clamp(…,0,1) → 100. (검증이 이런 weights를 거부하지만 함수도 독립적으로 안전)
    expect(
      computeFinalScore(autoTest, fullRubricResult, { tests: 1, rubric: 1 }),
    ).toBe(100);
  });

  it('0.5 경계는 반올림 올림한다(12.5 → 13)', () => {
    const autoTest: AutoTestResult = { passedCount: 1, totalCount: 4, cases: [] };
    const zeroRubric = normalizeRubricResult({ scores: [], feedback: '' }, rubric);
    // tests 25% * 0.5 + rubric 0% * 0.5 = 0.125 → 12.5 → round → 13
    expect(
      computeFinalScore(autoTest, zeroRubric, { tests: 0.5, rubric: 0.5 }),
    ).toBe(13);
  });
});
