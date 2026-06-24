/**
 * lineDiff.ts — 라인 단위 diff (LCS 기반, 순수 함수)
 *
 * 두 텍스트(또는 두 파일트리)를 줄 단위로 비교해 추가(add)/삭제(del)/유지(context)
 * 라인을 만든다. 교수 대시보드에서 "프롬프트가 만든 코드 변경점"을 GitHub식 +/− 로
 * 보여주는 데 쓴다(시점별 코드 스냅샷 비교). 외부 의존 없이 동작한다.
 *
 * 과제 파일은 작아 O(m*n) LCS로 충분하다. 매우 큰 파일은 호출부에서 방어한다.
 *
 * 사용처: features/author/GradingDashboardView (제출 코드 diff)
 */
import type { ProjectFiles } from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

export type DiffLineType = 'add' | 'del' | 'context';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface DiffStat {
  added: number;
  removed: number;
}

export type FileDiffStatus = 'added' | 'removed' | 'modified';

export interface FileDiff {
  path: string;
  status: FileDiffStatus;
  lines: DiffLine[];
  stat: DiffStat;
}

// ── 라인 diff ─────────────────────────────────────────────────────────────

/** 두 텍스트의 줄 단위 diff(LCS). 빈 문자열은 0줄로 본다. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.length > 0 ? before.split('\n') : [];
  const b = after.length > 0 ? after.split('\n') : [];
  const m = a.length;
  const n = b.length;

  // lcs[i][j] = a[i:] 와 b[j:] 의 최장 공통 부분수열 길이
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'context', text: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ type: 'del', text: a[i] });
      i += 1;
    } else {
      result.push({ type: 'add', text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    result.push({ type: 'del', text: a[i] });
    i += 1;
  }
  while (j < n) {
    result.push({ type: 'add', text: b[j] });
    j += 1;
  }
  return result;
}

/** diff 라인들에서 추가/삭제 줄 수를 센다. */
export function diffStat(lines: DiffLine[]): DiffStat {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === 'add') added += 1;
    else if (line.type === 'del') removed += 1;
  }
  return { added, removed };
}

// ── 파일트리 diff ───────────────────────────────────────────────────────────

/**
 * 두 파일트리 스냅샷(경로→내용)을 비교해 변경된 파일별 diff를 만든다. 내용이 같은
 * 파일은 결과에서 제외하고, 경로 기준 정렬로 안정적인 순서를 보장한다.
 */
export function diffFileSets(
  before: ProjectFiles,
  after: ProjectFiles,
): FileDiff[] {
  const paths = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const diffs: FileDiff[] = [];
  for (const path of [...paths].sort()) {
    const beforeText = before[path];
    const afterText = after[path];
    if (beforeText === afterText) continue; // 변경 없음
    const status: FileDiffStatus =
      beforeText === undefined ? 'added' : afterText === undefined ? 'removed' : 'modified';
    const lines = diffLines(beforeText ?? '', afterText ?? '');
    diffs.push({ path, status, lines, stat: diffStat(lines) });
  }
  return diffs;
}
