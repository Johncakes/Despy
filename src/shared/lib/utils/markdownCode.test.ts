/**
 * markdownCode.test.ts — extractStreamingCodeBlock 단위 테스트
 *
 * 스트리밍 중 코드 미러링의 핵심 로직이므로, 펜스 없음/작성 중/완성/다중
 * 블록 등 경계 케이스를 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import { extractStreamingCodeBlock } from './markdownCode';

describe('extractStreamingCodeBlock', () => {
  it('코드 펜스가 없으면 null', () => {
    expect(extractStreamingCodeBlock('여기 설명만 있어요')).toBeNull();
  });

  it('여는 펜스 + info 문자열만 있으면 빈 문자열', () => {
    expect(extractStreamingCodeBlock('설명\n```python')).toBe('');
  });

  it('작성 중(닫히지 않은) 블록의 현재 코드를 반환', () => {
    const streaming = '이렇게 풀어요:\n```python\ndef solve():\n    x = 1';
    expect(extractStreamingCodeBlock(streaming)).toBe('def solve():\n    x = 1');
  });

  it('닫힌 블록의 전체 코드를 반환 (info 문자열 제거)', () => {
    const closed = '설명\n```python\nprint(1)\n```\n끝.';
    expect(extractStreamingCodeBlock(closed)).toBe('print(1)\n');
  });

  it('info 문자열이 없는 펜스도 처리', () => {
    const noLang = '```\nhello\n```';
    expect(extractStreamingCodeBlock(noLang)).toBe('hello\n');
  });

  it('블록이 여러 개면 마지막(작성 중) 블록을 반환', () => {
    const multi = '```py\nA\n```\n중간\n```js\nB = 2';
    expect(extractStreamingCodeBlock(multi)).toBe('B = 2');
  });
});
