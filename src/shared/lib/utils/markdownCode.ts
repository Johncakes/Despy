/**
 * markdownCode.ts — 마크다운 코드블록 추출 유틸
 *
 * 스트리밍 중인 AI 답변(마크다운)에서 미러링 대상 ``` 코드 펜스의 내용을 뽑아낸다.
 * 펜스가 아직 닫히지 않았어도(작성 중) 현재까지의 코드를 반환해, 에디터로
 * 실시간 미러링하는 데 쓴다. 토큰 단위로 자라는 텍스트에 매번 호출된다.
 *
 * AI가 소스 코드 뒤에 실행 안내(```bash로 감싼 `npm install` 등)를 덧붙이는 일이
 * 잦은데, 단순히 "마지막 블록"을 고르면 그 쉘 명령이 소스 파일을 덮어써 미리보기가
 * 깨진다. 그래서 쉘/터미널 계열 info 문자열을 가진 블록은 미러링에서 제외하고,
 * 그 외(소스로 보이는) 마지막 블록을 고른다.
 *
 * 사용처: features/solve/AiChatPanel (AI 코드 → Monaco 실시간 반영)
 */

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * 미러링에서 제외할 코드 펜스 info 문자열(쉘/터미널/출력 계열).
 * 이 언어로 표시된 블록은 소스 파일이 아니므로 에디터에 반영하지 않는다.
 */
const NON_MIRRORABLE_INFO = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'console',
  'terminal',
  'cmd',
  'powershell',
  'ps1',
  'text',
  'plaintext',
  'txt',
  'diff',
  'log',
  'output',
]);

// ── Public API ────────────────────────────────────────────────────────────

/**
 * 마크다운 텍스트에서 미러링 대상이 되는 **마지막 소스 코드** 펜스(```)의 내용을 반환한다.
 *
 * - 코드 펜스가 하나도 없으면 `null` (에디터 미러링 안 함).
 * - 쉘/터미널 계열(`bash`·`sh`·`console` 등) 블록은 건너뛴다 — 소스 파일을
 *   실행 명령으로 덮어쓰지 않게 한다.
 * - 여는 줄(info 문자열)만 있고 본문 줄바꿈 전이면 아직 언어를 단정할 수 없으므로
 *   미러링하지 않는다(`null`) — 다음 토큰에서 판정한다.
 * - 펜스가 닫혔든(완성) 안 닫혔든(작성 중) 해당 블록의 코드 본문만 돌려준다.
 * - 여는 줄의 info 문자열(예: ```python의 'python')은 제거한다.
 */
export function extractStreamingCodeBlock(markdown: string): string | null {
  const segments = markdown.split('```');
  // 펜스가 없으면 segments 길이가 1 → 코드 없음
  if (segments.length < 2) return null;

  // ``` 로 분할하면 홀수 인덱스 조각이 "펜스 내부"다. 마지막 블록부터 뒤로 훑으며
  // 쉘/터미널이 아닌(소스로 미러링 가능한) 첫 블록을 고른다.
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    if (i % 2 === 0) continue; // 펜스 바깥(일반 텍스트 조각)
    const block = segments[i];
    const firstNewline = block.indexOf('\n');
    // 여는 줄(info)만 있고 본문 줄바꿈 전 → 언어 미확정. 미러링하지 않는다.
    if (firstNewline === -1) continue;
    const info = block.slice(0, firstNewline).trim().toLowerCase();
    if (NON_MIRRORABLE_INFO.has(info)) continue; // 쉘/터미널 블록은 제외
    // 첫 줄(info 문자열)을 제거한 나머지가 코드 본문
    return block.slice(firstNewline + 1);
  }
  return null;
}
