/**
 * markdownCode.ts — 마크다운 코드블록에서 "적용할 전체 파일"을 추출하는 유틸
 *
 * AI 답변(마크다운)을 에디터에 반영할 때, 단순히 "마지막 코드블록"을 파일에 덮어쓰면
 * AI가 부분 스니펫(예: `<p>…</p>` 한 줄, `const x = …` 조각)이나 실행 명령(```bash)을
 * 내놓을 때 그 조각이 파일 전체를 깨뜨린다. 그래서 Claude의 아티팩트처럼 **완성된(닫힌)
 * "파일 전체" 코드블록만** 골라 적용한다.
 *
 * 적용 대상 판별:
 *  - 닫힌(여닫음이 끝난) 코드블록만 본다 — 작성 중인 블록은 무시(중간 상태 미반영).
 *  - 쉘/터미널 계열(```bash 등)은 제외.
 *  - info 줄에 파일 경로가 있거나(예: ```jsx src/App.jsx) 본문이 "파일 전체"로
 *    보이면(예: `export default` 포함) 적용 후보로 인정한다. 부분 스니펫은 후보가
 *    아니므로 반영되지 않는다(파일이 조각으로 덮어써지지 않음).
 *  - 후보가 여럿이면 가장 마지막(최신) 후보를 택한다.
 *
 * 사용처: features/solve/AiChatPanel (AI 코드 → Monaco 안정 반영)
 */

// ── Types ─────────────────────────────────────────────────────────────────

/** 에디터에 적용할 파일 편집(전체 내용). */
export interface CompletedFileEdit {
  /** info 줄에서 감지한 대상 파일 경로. 없으면 null → 호출측이 활성 파일에 적용. */
  path: string | null;
  /** 적용할 파일 전체 내용 */
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * 적용에서 제외할 코드 펜스 info 문자열(쉘/터미널/출력 계열).
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

/** 경로로 인정할 파일 확장자(코드/스타일/마크업 계열). */
const PATH_EXTENSION = /\.(jsx?|tsx?|css|scss|html?|json|md|mjs|cjs|vue|svelte)$/;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * 마크다운에서 "에디터에 적용할 완성된 전체 파일"을 추출한다. 없으면 null.
 *
 * 부분 스니펫·쉘 명령·작성 중(미완성) 블록은 후보에서 제외되므로, 호출측은 반환값이
 * null이면 에디터를 건드리지 않으면 된다(조각으로 파일을 덮어쓰는 사고 방지).
 */
export function extractCompletedFileEdit(markdown: string): CompletedFileEdit | null {
  const segments = markdown.split('```');
  // 펜스가 없으면 segments 길이가 1 → 코드 없음
  if (segments.length < 2) return null;

  // ``` 분할 시 홀수 인덱스 조각이 "펜스 내부"다. 그중 마지막 조각(=segments.length-1
  // 이 홀수일 때)은 아직 닫히지 않은 작성 중 블록이므로 제외한다.
  // 마지막 블록부터 뒤로 훑으며 첫 번째 "적용 후보"를 고른다(최신 우선).
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    if (i % 2 === 0) continue; // 펜스 바깥(일반 텍스트 조각)
    if (i === segments.length - 1) continue; // 닫히지 않은(작성 중) 마지막 블록 제외

    const block = segments[i];
    const firstNewline = block.indexOf('\n');
    if (firstNewline === -1) continue; // info 줄만 있고 본문 없음

    // 경로는 원본 케이싱이 중요하므로(src/App.jsx) info 원문에서 뽑고, 쉘 판별만
    // 소문자 첫 토큰으로 한다.
    const info = block.slice(0, firstNewline).trim();
    const firstToken = info.split(/\s+/)[0]?.toLowerCase() ?? '';
    if (NON_MIRRORABLE_INFO.has(firstToken)) continue; // 쉘/터미널 블록 제외

    const content = block.slice(firstNewline + 1);
    const path = detectPath(info);
    // 경로 태그가 있거나 본문이 "파일 전체"로 보일 때만 적용 후보로 인정한다.
    if (path === null && !looksLikeFullFile(content)) continue;

    return { path, content };
  }

  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** info 줄에서 파일 경로 토큰을 찾는다(예: 'jsx src/App.jsx' → 'src/App.jsx'). 없으면 null. */
function detectPath(info: string): string | null {
  for (const token of info.split(/\s+/)) {
    if (token.includes('/') || PATH_EXTENSION.test(token)) return token;
  }
  return null;
}

/**
 * 본문이 "파일 전체"로 보이는지 판별한다 — 부분 스니펫과 구분하기 위한 보수적 휴리스틱.
 * 모듈 최상위 신호(`export default`·`export `·맨 앞 `import `)가 있으면 전체 파일로 본다.
 * 신호가 없으면(예: `<p>…</p>`, `const x = …` 조각) 적용하지 않아 파일 훼손을 막는다.
 */
function looksLikeFullFile(content: string): boolean {
  if (/\bexport\s+default\b/.test(content)) return true;
  if (/^\s*export\s+/m.test(content)) return true;
  if (/^\s*import\s+.+\bfrom\b/m.test(content)) return true;
  return false;
}
