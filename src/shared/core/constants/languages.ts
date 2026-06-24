/**
 * languages.ts — 지원 프로그래밍 언어 목록 (단일 출처)
 *
 * Monaco 에디터(언어 모드)와 초기 코드 스니펫, AI 채점 맥락용 표시명을 한곳에 모은다.
 * 문제의 allowedLanguageIds는 여기 정의된 id를 참조한다. 채점은 코드 실행이 아니라
 * AI 정성 판정이므로(P5) 언어별 실행 식별자는 더 이상 필요하지 않다.
 *
 * 사용처: 에디터 언어 선택, AI 채점 맥락, Monaco 모드 지정
 */
import type { SupportedLanguage } from '@/shared/core/types';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  {
    id: 'python',
    label: 'Python 3',
    monacoLanguage: 'python',
    defaultCode: ['import sys', '', 'def solve():', '    pass', '', 'solve()', ''].join('\n'),
  },
  {
    id: 'javascript',
    label: 'JavaScript (Node)',
    monacoLanguage: 'javascript',
    defaultCode: [
      "const input = require('fs').readFileSync(0, 'utf8').trim();",
      '',
      'function solve() {',
      '  // TODO',
      '}',
      '',
      'solve();',
      '',
    ].join('\n'),
  },
  {
    id: 'cpp',
    label: 'C++ (GCC)',
    monacoLanguage: 'cpp',
    defaultCode: [
      '#include <bits/stdc++.h>',
      'using namespace std;',
      '',
      'int main() {',
      '    ios::sync_with_stdio(false);',
      '    cin.tie(nullptr);',
      '    return 0;',
      '}',
      '',
    ].join('\n'),
  },
  {
    id: 'java',
    label: 'Java',
    monacoLanguage: 'java',
    defaultCode: [
      'import java.util.*;',
      '',
      'public class Main {',
      '    public static void main(String[] args) {',
      '        Scanner sc = new Scanner(System.in);',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
] as const;

/** id로 언어를 조회한다. 없으면 undefined. */
export function findLanguageById(id: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.id === id);
}

/** 풀이 화면 기본 선택 언어 */
export const DEFAULT_LANGUAGE_ID = 'python';
