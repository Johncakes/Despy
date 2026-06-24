/**
 * requestValidation.test.ts — 채점 요청 검증 단위 테스트
 *
 * 신뢰 경계의 핵심이므로, 필수 필드 누락·weights 합 오류·비객체 입력 등
 * 잘못된 페이로드를 차단하고 정상 요청은 통과시키는지 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import {
  validateGradeRequest,
  validateAlgorithmRequest,
} from './requestValidation';
import type {
  ChallengeGradingRequest,
  GradingRequest,
} from '@/shared/core/types';

const validRequest: ChallengeGradingRequest = {
  problemId: 'cart-delete',
  statement: '장바구니 삭제 기능',
  rubric: {
    criteria: [{ id: 'c1', description: '삭제', maxScore: 10 }],
    weights: { tests: 0.6, rubric: 0.4 },
  },
  submittedFiles: { 'src/Cart.jsx': '...' },
  autoTest: { passedCount: 1, totalCount: 2, cases: [] },
};

describe('validateGradeRequest', () => {
  it('정상 요청은 null(통과)', () => {
    expect(validateGradeRequest(validRequest)).toBeNull();
  });

  it('객체가 아닌 입력을 차단한다', () => {
    expect(validateGradeRequest(null)).not.toBeNull();
    expect(validateGradeRequest('문자열')).not.toBeNull();
    expect(validateGradeRequest(42)).not.toBeNull();
  });

  it('problemId 누락을 차단한다', () => {
    expect(validateGradeRequest({ ...validRequest, problemId: '' })).toMatch(
      /problemId/,
    );
  });

  it('rubric.criteria 누락을 차단한다', () => {
    const { rubric: _omit, ...rest } = validRequest;
    expect(validateGradeRequest(rest)).toMatch(/criteria/);
  });

  it('submittedFiles 누락을 차단한다', () => {
    const { submittedFiles: _omit, ...rest } = validRequest;
    expect(validateGradeRequest(rest)).toMatch(/submittedFiles/);
  });

  it('autoTest 누락을 차단한다', () => {
    const { autoTest: _omit, ...rest } = validRequest;
    expect(validateGradeRequest(rest)).toMatch(/autoTest/);
  });

  it('weights 누락을 차단한다', () => {
    const broken = {
      ...validRequest,
      rubric: { ...validRequest.rubric, weights: undefined },
    };
    expect(validateGradeRequest(broken)).toMatch(/weights/);
  });

  it('weights 합이 1.0이 아니면 차단한다 (finalScore 왜곡 방지)', () => {
    const broken = {
      ...validRequest,
      rubric: { ...validRequest.rubric, weights: { tests: 0.6, rubric: 0.3 } },
    };
    expect(validateGradeRequest(broken)).toMatch(/1\.0/);
  });

  it('합은 1이어도 각 weight가 [0,1] 밖이면 차단한다 ({tests:2, rubric:-1})', () => {
    const broken = {
      ...validRequest,
      rubric: { ...validRequest.rubric, weights: { tests: 2, rubric: -1 } },
    };
    expect(validateGradeRequest(broken)).toMatch(/0 이상 1 이하/);
  });

  it('NaN weight를 차단한다 (typeof number 통과 우회 방지)', () => {
    const broken = {
      ...validRequest,
      rubric: { ...validRequest.rubric, weights: { tests: NaN, rubric: NaN } },
    };
    expect(validateGradeRequest(broken)).toMatch(/0 이상 1 이하/);
  });

  it('빈 루브릭(criteria:[])을 차단한다', () => {
    const broken = {
      ...validRequest,
      rubric: { ...validRequest.rubric, criteria: [] },
    };
    expect(validateGradeRequest(broken)).toMatch(/criteria/);
  });

  it('부동소수 오차(0.7+0.3) 범위는 허용한다', () => {
    const ok = {
      ...validRequest,
      rubric: { ...validRequest.rubric, weights: { tests: 0.7, rubric: 0.3 } },
    };
    expect(validateGradeRequest(ok)).toBeNull();
  });
});

const validAlgorithmRequest: GradingRequest = {
  problemId: 'two-sum',
  languageId: 'python',
  statement: '두 수의 합',
  sourceCode: 'print(sum(...))',
  testCases: [{ id: 't1', input: '1 2', expectedOutput: '3', isPublic: true }],
};

describe('validateAlgorithmRequest', () => {
  it('정상 요청은 null(통과)', () => {
    expect(validateAlgorithmRequest(validAlgorithmRequest)).toBeNull();
  });

  it('객체가 아닌 입력을 차단한다', () => {
    expect(validateAlgorithmRequest(null)).not.toBeNull();
    expect(validateAlgorithmRequest('x')).not.toBeNull();
  });

  it('problemId/languageId/sourceCode 누락을 차단한다', () => {
    expect(
      validateAlgorithmRequest({ ...validAlgorithmRequest, problemId: '' }),
    ).toMatch(/problemId/);
    expect(
      validateAlgorithmRequest({ ...validAlgorithmRequest, languageId: '' }),
    ).toMatch(/languageId/);
    const { sourceCode: _omit, ...noCode } = validAlgorithmRequest;
    expect(validateAlgorithmRequest(noCode)).toMatch(/sourceCode/);
  });

  it('빈 testCases를 차단한다(채점 무의미)', () => {
    expect(
      validateAlgorithmRequest({ ...validAlgorithmRequest, testCases: [] }),
    ).toMatch(/testCases/);
  });

  it('testCase 필드 누락을 차단한다', () => {
    const broken = {
      ...validAlgorithmRequest,
      testCases: [{ id: 't1', input: '1' }],
    };
    expect(validateAlgorithmRequest(broken)).toMatch(/testCases/);
  });

  it('빈 문자열 sourceCode는 허용한다(미작성 제출도 채점 대상)', () => {
    expect(
      validateAlgorithmRequest({ ...validAlgorithmRequest, sourceCode: '' }),
    ).toBeNull();
  });
});
