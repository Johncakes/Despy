/**
 * submissionStore.test.ts — 제출 보관 스토어 단위 테스트
 *
 * 제출 추가(addSubmission)의 누적·삽입 순서·과제별 격리, 초기화(clearSubmissions),
 * 동기 조회 헬퍼(getSubmissions)를 검증한다. vitest는 jsdom 환경(localStorage 있음)에서
 * 돌지만, 각 테스트는 setState로 submissions를 비워 결정적으로 시작한다.
 *
 * 사용처: `npm run test`
 */
import { beforeEach, describe, it, expect } from 'vitest';
import type { ChallengeGradingResult } from '@/shared/core/types';
import {
  useSubmissionStore,
  getSubmissions,
  type StoredSubmission,
} from './submissionStore';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeSubmission(
  id: string,
  studentName: string,
  finalScore: number,
  submittedAt: number,
): StoredSubmission {
  const result: ChallengeGradingResult = {
    problemId: 'c1',
    autoTest: { passedCount: 1, totalCount: 2, cases: [] },
    rubric: { scores: [], totalScore: finalScore, maxScore: 100, feedback: '' },
    finalScore,
    submittedAt,
  };
  return { id, studentName, result };
}

const store = () => useSubmissionStore.getState();

beforeEach(() => {
  useSubmissionStore.setState({ submissions: {} });
});

// ── addSubmission ─────────────────────────────────────────────────────────────

describe('addSubmission', () => {
  it('과제 목록이 없으면 새로 만들어 추가한다', () => {
    store().addSubmission('c1', makeSubmission('s1', 'Alice', 87, 1000));
    expect(store().submissions.c1).toHaveLength(1);
    expect(store().submissions.c1[0].studentName).toBe('Alice');
  });

  it('삽입 순서대로 누적된다', () => {
    store().addSubmission('c1', makeSubmission('s1', 'Alice', 87, 1000));
    store().addSubmission('c1', makeSubmission('s2', 'Bob', 64, 2000));

    expect(store().submissions.c1.map((item) => item.id)).toEqual(['s1', 's2']);
  });

  it('과제별로 격리된다', () => {
    store().addSubmission('c1', makeSubmission('s1', 'Alice', 87, 1000));
    store().addSubmission('c2', makeSubmission('s2', 'Bob', 64, 2000));

    expect(store().submissions.c1).toHaveLength(1);
    expect(store().submissions.c2).toHaveLength(1);
    expect(store().submissions.c2[0].studentName).toBe('Bob');
  });
});

// ── clearSubmissions ────────────────────────────────────────────────────────

describe('clearSubmissions', () => {
  it('해당 과제의 제출 기록을 비운다', () => {
    store().addSubmission('c1', makeSubmission('s1', 'Alice', 87, 1000));
    store().clearSubmissions('c1');
    expect(store().submissions.c1).toBeUndefined();
  });

  it('기록이 없으면 no-op', () => {
    store().clearSubmissions('missing');
    expect(store().submissions.missing).toBeUndefined();
  });
});

// ── getSubmissions 헬퍼 ─────────────────────────────────────────────────────

describe('getSubmissions', () => {
  it('과제 제출 목록을 동기 조회한다(없으면 빈 배열)', () => {
    expect(getSubmissions('c1')).toEqual([]);
    store().addSubmission('c1', makeSubmission('s1', 'Alice', 87, 1000));
    expect(getSubmissions('c1')).toHaveLength(1);
  });
});
