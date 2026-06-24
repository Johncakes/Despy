/**
 * solveSessionStore.test.ts — 풀이 세션 상태/사용량 카운터 단위 테스트
 *
 * AI 한도 강제의 근거가 되는 사용량 카운터(질문 횟수·누적 토큰)와, 세션 가드
 * 불변식을 검증한다: ensureSession의 멱등성(기존 진행 보존), 세션 없을 때의 no-op,
 * recordAiTurn 누적, 문제별 격리, resetSession의 덮어쓰기.
 *
 * vitest는 프로젝트에 별도 config가 없어 node 환경에서 돈다(localStorage 없음).
 * persist는 storage 부재 시 인메모리로 degrade되므로, 각 테스트는 setState로
 * sessions를 비워 결정적으로 시작한다.
 *
 * 사용처: `npm run test`
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { useSolveSessionStore, type SolveSession } from './solveSessionStore';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

const defaults = (): SolveSession => ({
  languageId: 'python',
  code: 'print("hi")',
  questionsUsed: 0,
  tokensUsed: 0,
});

const store = () => useSolveSessionStore.getState();
const session = (problemId: string) => store().sessions[problemId];

beforeEach(() => {
  // persist된 잔여 상태와 무관하게 각 테스트를 빈 sessions에서 시작한다.
  useSolveSessionStore.setState({ sessions: {} });
});

// ── ensureSession ─────────────────────────────────────────────────────────────

describe('ensureSession', () => {
  it('세션이 없으면 기본값으로 생성한다', () => {
    store().ensureSession('p1', defaults());
    expect(session('p1')).toEqual(defaults());
  });

  it('멱등: 이미 있으면 덮어쓰지 않고 진행 상태를 보존한다', () => {
    store().ensureSession('p1', defaults());
    store().setCode('p1', 'in-progress');
    store().recordAiTurn('p1', 500);

    // 다시 ensure해도 누적된 코드/사용량이 초기화되면 안 된다.
    store().ensureSession('p1', defaults());

    expect(session('p1').code).toBe('in-progress');
    expect(session('p1').questionsUsed).toBe(1);
    expect(session('p1').tokensUsed).toBe(500);
  });
});

// ── setCode / setLanguage ─────────────────────────────────────────────────────

describe('setCode', () => {
  it('기존 세션의 코드를 갱신하고 다른 필드는 보존한다', () => {
    store().ensureSession('p1', defaults());
    store().recordAiTurn('p1', 300);
    store().setCode('p1', 'updated');

    expect(session('p1').code).toBe('updated');
    expect(session('p1').languageId).toBe('python');
    expect(session('p1').tokensUsed).toBe(300);
  });

  it('세션이 없으면 no-op(세션을 만들지 않는다)', () => {
    store().setCode('missing', 'x');
    expect(session('missing')).toBeUndefined();
  });
});

describe('setLanguage', () => {
  it('언어와 코드를 함께 바꾸고 사용량 카운터는 보존한다', () => {
    store().ensureSession('p1', defaults());
    store().recordAiTurn('p1', 100);
    store().setLanguage('p1', 'javascript', 'console.log(1)');

    expect(session('p1').languageId).toBe('javascript');
    expect(session('p1').code).toBe('console.log(1)');
    expect(session('p1').questionsUsed).toBe(1);
    expect(session('p1').tokensUsed).toBe(100);
  });

  it('세션이 없으면 no-op', () => {
    store().setLanguage('missing', 'javascript', 'x');
    expect(session('missing')).toBeUndefined();
  });
});

// ── recordAiTurn ──────────────────────────────────────────────────────────────

describe('recordAiTurn', () => {
  it('질문 횟수를 1 늘리고 토큰을 누적한다', () => {
    store().ensureSession('p1', defaults());
    store().recordAiTurn('p1', 1200);

    expect(session('p1').questionsUsed).toBe(1);
    expect(session('p1').tokensUsed).toBe(1200);
  });

  it('여러 턴이 누적된다', () => {
    store().ensureSession('p1', defaults());
    store().recordAiTurn('p1', 1000);
    store().recordAiTurn('p1', 250);
    store().recordAiTurn('p1', 0);

    expect(session('p1').questionsUsed).toBe(3);
    expect(session('p1').tokensUsed).toBe(1250);
  });

  it('세션이 없으면 no-op(카운터를 만들지 않는다)', () => {
    store().recordAiTurn('missing', 999);
    expect(session('missing')).toBeUndefined();
  });
});

// ── resetSession ──────────────────────────────────────────────────────────────

describe('resetSession', () => {
  it('진행/사용량을 기본값으로 되돌린다(ensureSession과 달리 덮어쓴다)', () => {
    store().ensureSession('p1', defaults());
    store().setCode('p1', 'dirty');
    store().recordAiTurn('p1', 5000);

    store().resetSession('p1', defaults());

    expect(session('p1')).toEqual(defaults());
  });
});

// ── 문제별 격리 ────────────────────────────────────────────────────────────────

describe('문제별 격리', () => {
  it('한 문제의 사용량 기록이 다른 문제에 영향을 주지 않는다', () => {
    store().ensureSession('p1', defaults());
    store().ensureSession('p2', defaults());

    store().recordAiTurn('p1', 700);
    store().setCode('p2', 'p2 code');

    expect(session('p1').tokensUsed).toBe(700);
    expect(session('p1').code).toBe('print("hi")');
    expect(session('p2').tokensUsed).toBe(0);
    expect(session('p2').code).toBe('p2 code');
  });
});
