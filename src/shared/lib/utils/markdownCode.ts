/**
 * markdownCode.ts — 마크다운 코드블록 추출 유틸
 *
 * 스트리밍 중인 AI 답변(마크다운)에서 마지막 ``` 코드 펜스의 내용을 뽑아낸다.
 * 펜스가 아직 닫히지 않았어도(작성 중) 현재까지의 코드를 반환해, 에디터로
 * 실시간 미러링하는 데 쓴다. 토큰 단위로 자라는 텍스트에 매번 호출된다.
 *
 * 사용처: features/solve/AiChatPanel (AI 코드 → Monaco 실시간 반영)
 */

/**
 * 마크다운 텍스트에서 **마지막** 코드 펜스(```) 블록의 코드 내용을 반환한다.
 *
 * - 코드 펜스가 하나도 없으면 `null` (에디터 미러링 안 함).
 * - 여는 펜스만 있고 코드 줄이 아직 없으면 `''` (이제 막 쓰기 시작).
 * - 펜스가 닫혔든(완성) 안 닫혔든(작성 중) 해당 블록의 코드만 돌려준다.
 * - 여는 줄의 info 문자열(예: ```python의 'python')은 제거한다.
 */
export function extractStreamingCodeBlock(markdown: string): string | null {
  const segments = markdown.split('```');
  // 펜스가 없으면 segments 길이가 1 → 코드 없음
  if (segments.length < 2) return null;

  // ``` 로 분할하면 홀수 인덱스 조각이 "펜스 내부"다.
  let lastCodeIndex = -1;
  for (let i = 1; i < segments.length; i += 2) {
    lastCodeIndex = i;
  }
  if (lastCodeIndex === -1) return null;

  const block = segments[lastCodeIndex];
  const firstNewline = block.indexOf('\n');
  // 여는 줄(info 문자열)만 있고 줄바꿈이 아직 없음 → 코드 본문 시작 전
  if (firstNewline === -1) return '';
  // 첫 줄(info 문자열)을 제거한 나머지가 코드 본문
  return block.slice(firstNewline + 1);
}
