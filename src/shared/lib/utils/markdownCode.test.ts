/**
 * markdownCode.test.ts — extractCompletedFileEdit 단위 테스트
 *
 * AI 코드 반영의 핵심 안정성 로직이므로, "완성된 전체 파일만 적용"하고 부분
 * 스니펫·쉘 명령·작성 중 블록은 적용하지 않는 경계 케이스를 검증한다.
 *
 * 사용처: `npm run test`
 */
import { describe, it, expect } from 'vitest';
import { extractCompletedFileEdit } from './markdownCode';

describe('extractCompletedFileEdit', () => {
  it('코드 펜스가 없으면 null', () => {
    expect(extractCompletedFileEdit('여기 설명만 있어요')).toBeNull();
  });

  it('완성된 전체 파일 블록(export default)을 적용 후보로 반환', () => {
    const md =
      '이렇게 바꾸세요:\n```jsx\nimport { useState } from "react";\nexport default function App() { return null; }\n```\n끝.';
    const edit = extractCompletedFileEdit(md);
    expect(edit?.content).toContain('export default function App()');
    expect(edit?.path).toBeNull();
  });

  it('info 줄의 파일 경로를 감지해 path로 반환', () => {
    const md = '```jsx src/App.jsx\nexport default function App() {}\n```';
    const edit = extractCompletedFileEdit(md);
    expect(edit?.path).toBe('src/App.jsx');
  });

  it('부분 스니펫(전체 파일 아님)은 적용하지 않음(null)', () => {
    const md =
      '1. 변수 추가:\n```jsx\nconst parityText = count % 2 === 0 ? "짝수" : "홀수";\n```\n2. 표시:\n```jsx\n<p>현재 값은 {parityText}</p>\n```';
    expect(extractCompletedFileEdit(md)).toBeNull();
  });

  it('전체 파일 + 뒤따르는 쉘 명령이 있으면 전체 파일만 반환', () => {
    const md =
      '```jsx\nexport default function App() { return null; }\n```\n실행:\n```bash\nnpm run dev\n```';
    const edit = extractCompletedFileEdit(md);
    expect(edit?.content).toContain('export default function App()');
  });

  it('작성 중(닫히지 않은) 블록은 무시한다', () => {
    const streaming = '작성 중:\n```jsx\nexport default function App() {';
    expect(extractCompletedFileEdit(streaming)).toBeNull();
  });

  it('경로 태그가 있으면 본문이 조각이어도 그 파일에 적용', () => {
    const md = '```css src/index.css\n.app { color: red; }\n```';
    const edit = extractCompletedFileEdit(md);
    expect(edit?.path).toBe('src/index.css');
    expect(edit?.content).toContain('.app');
  });

  it('전체 파일 블록이 여러 개면 마지막(최신) 것을 반환', () => {
    const md =
      '```jsx\nexport default function A() {}\n```\n수정:\n```jsx\nexport default function B() {}\n```';
    const edit = extractCompletedFileEdit(md);
    expect(edit?.content).toContain('function B()');
  });
});
