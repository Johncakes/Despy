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

  it('여는 펜스 + info 문자열만 있고 본문 줄바꿈 전이면 null (언어 미확정)', () => {
    expect(extractStreamingCodeBlock('설명\n```python')).toBeNull();
  });

  it('info 줄바꿈 직후 본문이 비어 있으면 빈 문자열(쓰기 시작)', () => {
    expect(extractStreamingCodeBlock('설명\n```python\n')).toBe('');
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

  it('블록이 여러 개면 마지막(작성 중) 소스 블록을 반환', () => {
    const multi = '```py\nA\n```\n중간\n```js\nB = 2';
    expect(extractStreamingCodeBlock(multi)).toBe('B = 2');
  });

  it('소스 블록 뒤 쉘 명령(```bash) 블록은 건너뛰고 소스 블록을 반환', () => {
    const withShell =
      '코드:\n```jsx\nconst a = 1;\n```\n실행:\n```bash\nnpm install\nnpm run dev\n```';
    expect(extractStreamingCodeBlock(withShell)).toBe('const a = 1;\n');
  });

  it('쉘(```sh) 블록만 있으면 null (소스 파일을 덮어쓰지 않음)', () => {
    const onlyShell = '아래 명령을 실행하세요:\n```sh\nnpm run dev\n```';
    expect(extractStreamingCodeBlock(onlyShell)).toBeNull();
  });

  it('소스 블록 뒤 쉘 펜스가 막 열린(스트리밍) 중에도 소스 블록을 유지', () => {
    const streamingShell = '```jsx\nconst a = 1;\n```\n실행:\n```bash';
    expect(extractStreamingCodeBlock(streamingShell)).toBe('const a = 1;\n');
  });
});
