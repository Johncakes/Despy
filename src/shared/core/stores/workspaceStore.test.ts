/**
 * workspaceStore.test.ts — 워크스페이스 영속 스토어 액션 단위 테스트
 *
 * 파일 델타 저장(saveFileDelta)·활성 파일 저장(saveActivePath)·AI 사용량 누적
 * (recordAiTurn)·세션 초기화(resetSession)의 불변식을 검증한다. 특히 세션이 없을 때
 * 자동 생성하면서 다른 필드는 보존하는지, 과제별로 격리되는지를 본다.
 *
 * vitest는 jsdom 환경에서 돌며 jsdom은 IndexedDB를 구현하지 않으므로, idbStorage는
 * no-op으로 degrade하고 persist는 인메모리로 동작한다. 각 테스트는 setState로
 * sessions를 비워 결정적으로 시작한다.
 *
 * 사용처: `npm run test`
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

const store = () => useWorkspaceStore.getState();
const session = (challengeId: string) => store().sessions[challengeId];

beforeEach(() => {
  // persist된 잔여 상태와 무관하게 각 테스트를 빈 sessions에서 시작한다.
  useWorkspaceStore.setState({ sessions: {} });
});

// ── saveFileDelta ─────────────────────────────────────────────────────────────

describe('saveFileDelta', () => {
  it('세션이 없으면 델타로 새 세션을 만든다', () => {
    store().saveFileDelta('c1', { 'src/App.jsx': 'edited' });
    expect(session('c1').fileDelta).toEqual({ 'src/App.jsx': 'edited' });
    expect(session('c1').questionsUsed).toBe(0);
  });

  it('델타를 통째로 교체하고 AI 사용량은 보존한다', () => {
    store().recordAiTurn('c1', 500);
    store().saveFileDelta('c1', { 'a.js': '1' });
    store().saveFileDelta('c1', { 'b.js': '2' });

    expect(session('c1').fileDelta).toEqual({ 'b.js': '2' });
    expect(session('c1').questionsUsed).toBe(1);
    expect(session('c1').tokensUsed).toBe(500);
  });
});

// ── saveActivePath ──────────────────────────────────────────────────────────

describe('saveActivePath', () => {
  it('활성 파일 경로를 저장한다(세션 없으면 생성)', () => {
    store().saveActivePath('c1', 'src/Cart.jsx');
    expect(session('c1').activePath).toBe('src/Cart.jsx');
  });

  it('같은 경로면 상태를 바꾸지 않는다(참조 안정)', () => {
    store().saveActivePath('c1', 'src/Cart.jsx');
    const before = session('c1');
    store().saveActivePath('c1', 'src/Cart.jsx');
    expect(session('c1')).toBe(before);
  });
});

// ── recordAiTurn ──────────────────────────────────────────────────────────────

describe('recordAiTurn', () => {
  it('질문 횟수를 1 늘리고 토큰을 누적한다(세션 없으면 생성)', () => {
    store().recordAiTurn('c1', 1200);
    expect(session('c1').questionsUsed).toBe(1);
    expect(session('c1').tokensUsed).toBe(1200);
  });

  it('여러 턴이 누적된다', () => {
    store().recordAiTurn('c1', 1000);
    store().recordAiTurn('c1', 250);
    store().recordAiTurn('c1', 0);

    expect(session('c1').questionsUsed).toBe(3);
    expect(session('c1').tokensUsed).toBe(1250);
  });

  it('파일 델타를 보존하며 사용량만 갱신한다', () => {
    store().saveFileDelta('c1', { 'a.js': 'x' });
    store().recordAiTurn('c1', 300);

    expect(session('c1').fileDelta).toEqual({ 'a.js': 'x' });
    expect(session('c1').tokensUsed).toBe(300);
  });
});

// ── resetSession ──────────────────────────────────────────────────────────────

describe('resetSession', () => {
  it('해당 과제 세션을 제거한다', () => {
    store().saveFileDelta('c1', { 'a.js': 'x' });
    store().resetSession('c1');
    expect(session('c1')).toBeUndefined();
  });

  it('세션이 없으면 no-op', () => {
    store().resetSession('missing');
    expect(session('missing')).toBeUndefined();
  });
});

// ── 과제별 격리 ────────────────────────────────────────────────────────────────

describe('과제별 격리', () => {
  it('한 과제의 기록이 다른 과제에 영향을 주지 않는다', () => {
    store().recordAiTurn('c1', 700);
    store().saveFileDelta('c2', { 'b.js': 'y' });

    expect(session('c1').tokensUsed).toBe(700);
    expect(session('c1').fileDelta).toEqual({});
    expect(session('c2').tokensUsed).toBe(0);
    expect(session('c2').fileDelta).toEqual({ 'b.js': 'y' });
  });
});
