/**
 * lineDiff.test.ts — 라인/파일트리 diff 단위 테스트
 *
 * LCS diff가 추가·삭제·유지 라인을 바르게 분류하는지, 파일트리 비교가 변경된 파일만
 * 상태(added/removed/modified)와 함께 내는지 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import { diffLines, diffStat, diffFileSets } from './lineDiff';

describe('diffLines', () => {
  it('한 줄 추가를 add로 표시한다', () => {
    const lines = diffLines('a\nb', 'a\nb\nc');
    expect(lines).toEqual([
      { type: 'context', text: 'a' },
      { type: 'context', text: 'b' },
      { type: 'add', text: 'c' },
    ]);
  });

  it('한 줄 교체를 del + add로 표시한다', () => {
    const lines = diffLines('a\nb\nc', 'a\nX\nc');
    expect(lines.filter((l) => l.type === 'del')).toEqual([{ type: 'del', text: 'b' }]);
    expect(lines.filter((l) => l.type === 'add')).toEqual([{ type: 'add', text: 'X' }]);
  });

  it('빈→내용은 전부 add', () => {
    expect(diffStat(diffLines('', 'a\nb'))).toEqual({ added: 2, removed: 0 });
  });

  it('동일 텍스트는 변경 0', () => {
    expect(diffStat(diffLines('a\nb', 'a\nb'))).toEqual({ added: 0, removed: 0 });
  });
});

describe('diffFileSets', () => {
  it('추가/수정/삭제 파일을 상태와 함께 낸다(동일 파일 제외)', () => {
    const before = { 'a.js': 'x', 'keep.js': 'same', 'gone.js': 'bye' };
    const after = { 'a.js': 'y', 'keep.js': 'same', 'new.js': 'hi' };
    const diffs = diffFileSets(before, after);
    const byPath = Object.fromEntries(diffs.map((d) => [d.path, d.status]));

    expect(byPath).toEqual({ 'a.js': 'modified', 'gone.js': 'removed', 'new.js': 'added' });
    expect(diffs.find((d) => d.path === 'keep.js')).toBeUndefined();
  });

  it('경로 기준 정렬로 안정적 순서', () => {
    const diffs = diffFileSets({ 'z.js': '1' }, { 'a.js': '2', 'z.js': '3' });
    expect(diffs.map((d) => d.path)).toEqual(['a.js', 'z.js']);
  });
});
