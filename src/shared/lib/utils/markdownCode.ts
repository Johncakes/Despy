/**
 * markdownCode.ts — AI 답변에서 "부분 교체(SEARCH/REPLACE) 편집"을 파싱·적용하는 유틸
 *
 * 파일 전체를 다시 받아 덮어쓰면(토큰 낭비) 부분 스니펫이 파일을 깨뜨리는 사고가 났다.
 * 대신 Claude/Aider의 편집 도구처럼 **"찾을 코드 → 바꿀 코드"** 한 쌍만 받아, 파일에서
 * 정확히 일치하는 곳만 기계적으로 교체한다. 핵심은 안정성이다:
 *  - SEARCH 텍스트가 **정확히 1곳**에 일치할 때만 적용한다.
 *  - 못 찾거나(없음) 여러 곳에 모호하게 일치하면 **그 편집을 거부**한다(파일 보존).
 *  - 따라서 낡은/잘못된 SEARCH가 파일을 훼손할 수 없다.
 * 또한 전체 파일이 아니라 바뀐 부분만 오가므로 토큰 효율적이다.
 *
 * 형식(교수 가드레일과 별개로 앱이 AI에 주입하는 출력 계약 — agent/route.ts):
 *   ```edit src/App.jsx        ← (선택) 첫 줄 info에 대상 파일 경로
 *   <<<<<<< SEARCH
 *   (파일에 있는 원본 코드 그대로)
 *   =======
 *   (바꿀 새 코드)
 *   >>>>>>> REPLACE
 *   ```
 *
 * 사용처: features/solve/AiChatPanel(파싱) · ChallengeSolveView/SolveView(파일에 적용)
 */

// ── Types ─────────────────────────────────────────────────────────────────

/** AI가 제안한 부분 교체 1건. */
export interface FileEdit {
  /** 대상 파일 경로(편집 블록에서 감지). 없으면 null → 호출측이 활성/단일 파일에 적용. */
  path: string | null;
  /** 파일에서 찾을 원본 텍스트(정확 일치) */
  search: string;
  /** 교체할 새 텍스트 */
  replace: string;
}

/** 단일 파일에 편집 1건을 적용한 결과. */
export interface ApplyEditResult {
  ok: boolean;
  /** 적용 성공 시 새 내용, 실패 시 원본 그대로 */
  content: string;
  /** 실패 사유 — 'empty'(빈 SEARCH) · 'not-found'(없음) · 'ambiguous'(여러 곳 일치) */
  reason?: 'empty' | 'not-found' | 'ambiguous';
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * SEARCH/REPLACE 블록 매처. 마커 길이/공백/CRLF에 관대하게 잡는다.
 * group1 = SEARCH 본문, group2 = REPLACE 본문(둘 다 비어 있을 수 있음).
 * `>{3,} REPLACE`가 닫혀야(완성) 매칭되므로 작성 중(미완성) 블록은 잡히지 않는다.
 */
const SEARCH_REPLACE_RE =
  /<{3,}\s*SEARCH[^\n]*\r?\n([\s\S]*?)\r?\n?={3,}[^\n]*\r?\n([\s\S]*?)\r?\n?>{3,}\s*REPLACE/g;

/** 경로로 인정할 파일 확장자(코드/스타일/마크업 계열). */
const PATH_EXTENSION = /\.(jsx?|tsx?|css|scss|html?|json|md|mjs|cjs|vue|svelte)$/;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * AI 답변(마크다운)에서 완성된 SEARCH/REPLACE 편집을 모두 파싱한다. 없으면 빈 배열.
 * 각 편집의 path는 해당 블록 바로 앞 줄(펜스 info 또는 경로 줄)에서 추정한다(없으면 null).
 */
export function parseSearchReplaceEdits(markdown: string): FileEdit[] {
  const edits: FileEdit[] = [];
  for (const match of markdown.matchAll(SEARCH_REPLACE_RE)) {
    const search = match[1] ?? '';
    const replace = match[2] ?? '';
    const before = markdown.slice(0, match.index ?? 0);
    edits.push({ path: detectPathBefore(before), search, replace });
  }
  return edits;
}

/**
 * 단일 파일 내용에 편집 1건을 적용한다 — SEARCH가 **정확히 1곳**에 일치할 때만 교체한다.
 * 빈 SEARCH·미일치·복수 일치는 거부해(원본 유지) 파일 훼손을 막는다.
 */
export function applyFileEdit(
  content: string,
  search: string,
  replace: string,
): ApplyEditResult {
  if (search.length === 0) return { ok: false, content, reason: 'empty' };

  const first = content.indexOf(search);
  if (first === -1) return { ok: false, content, reason: 'not-found' };

  const second = content.indexOf(search, first + search.length);
  if (second !== -1) return { ok: false, content, reason: 'ambiguous' };

  const next = content.slice(0, first) + replace + content.slice(first + search.length);
  return { ok: true, content: next };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 편집 블록 앞 텍스트에서 대상 파일 경로를 추정한다. 바로 앞의 비어 있지 않은 1~2줄
 * (펜스 info `\`\`\`edit src/App.jsx` 또는 경로만 적힌 줄)에서 경로 토큰을 찾는다.
 */
function detectPathBefore(before: string): string | null {
  const lines = before.split('\n');
  let inspected = 0;
  for (let i = lines.length - 1; i >= 0 && inspected < 2; i -= 1) {
    const line = lines[i].trim();
    if (line === '') continue;
    inspected += 1;
    const path = detectPathInLine(line);
    if (path) return path;
  }
  return null;
}

/** 한 줄에서 경로처럼 보이는 토큰을 찾는다(예: '```edit src/App.jsx' → 'src/App.jsx'). */
function detectPathInLine(line: string): string | null {
  // 펜스 백틱을 떼고 토큰 단위로 검사한다.
  const stripped = line.replace(/`+/g, ' ');
  for (const token of stripped.split(/\s+/)) {
    if (token.includes('/') || PATH_EXTENSION.test(token)) return token;
  }
  return null;
}
