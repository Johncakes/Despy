/**
 * markdownCode.test.ts — SEARCH/REPLACE 편집 파싱·적용 단위 테스트
 *
 * AI 코드 반영의 안정성 핵심이므로, 파싱(경로 감지·완성 블록만)과 적용(정확 1곳
 * 일치만 교체, 미일치·복수 일치 거부)의 경계 케이스를 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import { parseSearchReplaceEdits, applyFileEdit } from './markdownCode';

describe('parseSearchReplaceEdits', () => {
  it('편집 블록이 없으면 빈 배열', () => {
    expect(parseSearchReplaceEdits('그냥 설명입니다')).toEqual([]);
  });

  it('단일 SEARCH/REPLACE 블록을 파싱한다', () => {
    const md = [
      '이렇게 바꾸세요:',
      '```edit src/App.jsx',
      '<<<<<<< SEARCH',
      '  const [count, setCount] = useState(0);',
      '=======',
      '  const [count, setCount] = useState(0);',
      "  const parityText = count % 2 === 0 ? '짝수' : '홀수';",
      '>>>>>>> REPLACE',
      '```',
    ].join('\n');
    const edits = parseSearchReplaceEdits(md);
    expect(edits).toHaveLength(1);
    expect(edits[0].path).toBe('src/App.jsx');
    expect(edits[0].search).toBe('  const [count, setCount] = useState(0);');
    expect(edits[0].replace).toContain('parityText');
  });

  it('경로 태그가 없으면 path는 null', () => {
    const md = [
      '```edit',
      '<<<<<<< SEARCH',
      'a',
      '=======',
      'b',
      '>>>>>>> REPLACE',
      '```',
    ].join('\n');
    expect(parseSearchReplaceEdits(md)[0].path).toBeNull();
  });

  it('여러 블록을 모두 파싱한다', () => {
    const md = [
      '```edit src/App.jsx',
      '<<<<<<< SEARCH',
      'a',
      '=======',
      'A',
      '>>>>>>> REPLACE',
      '```',
      '그리고:',
      '```edit src/index.css',
      '<<<<<<< SEARCH',
      'b',
      '=======',
      'B',
      '>>>>>>> REPLACE',
      '```',
    ].join('\n');
    const edits = parseSearchReplaceEdits(md);
    expect(edits).toHaveLength(2);
    expect(edits[1].path).toBe('src/index.css');
  });

  it('작성 중(닫히지 않은) 블록은 파싱하지 않는다', () => {
    const md = ['```edit', '<<<<<<< SEARCH', 'a', '=======', 'b(작성 중…'].join('\n');
    expect(parseSearchReplaceEdits(md)).toEqual([]);
  });
});

describe('applyFileEdit', () => {
  const file = 'line1\nTARGET\nline3';

  it('정확히 1곳 일치하면 교체한다', () => {
    const res = applyFileEdit(file, 'TARGET', 'CHANGED');
    expect(res.ok).toBe(true);
    expect(res.content).toBe('line1\nCHANGED\nline3');
  });

  it('일치하는 곳이 없으면 거부(원본 유지)', () => {
    const res = applyFileEdit(file, 'NOPE', 'X');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not-found');
    expect(res.content).toBe(file);
  });

  it('여러 곳에 일치하면 모호하므로 거부(원본 유지)', () => {
    const res = applyFileEdit('x\nx\nx', 'x', 'y');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('ambiguous');
    expect(res.content).toBe('x\nx\nx');
  });

  it('빈 SEARCH는 거부한다', () => {
    const res = applyFileEdit(file, '', 'X');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('empty');
  });

  it('여러 줄 블록도 정확 일치로 교체한다', () => {
    const content = 'a\nfoo\nbar\nb';
    const res = applyFileEdit(content, 'foo\nbar', 'baz');
    expect(res.ok).toBe(true);
    expect(res.content).toBe('a\nbaz\nb');
  });
});
