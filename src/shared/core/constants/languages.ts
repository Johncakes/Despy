/**
 * languages.ts — 지원 프로그래밍 언어 목록 (단일 출처)
 *
 * Judge0 채점(language_id)과 Monaco 에디터(언어 모드), 초기 코드 스니펫을 한곳에
 * 모은다. 문제의 allowedLanguageIds는 여기 정의된 id를 참조한다.
 * Judge0 CE의 기본 language_id 기준이며, 채점 서버 구성에 따라 조정될 수 있다.
 *
 * 사용처: 에디터 언어 선택, 채점 요청(judge0Id), Monaco 모드 지정
 */
import type { SupportedLanguage } from '@/shared/core/types';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  {
    id: 'python',
    label: 'Python 3',
    judge0Id: 71, // Judge0 CE: Python (3.8.1)
    monacoLanguage: 'python',
    defaultCode: ['import sys', '', 'def solve():', '    pass', '', 'solve()', ''].join('\n'),
  },
  {
    id: 'javascript',
    label: 'JavaScript (Node)',
    judge0Id: 63, // Judge0 CE: JavaScript (Node.js 12.14.0)
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
    judge0Id: 54, // Judge0 CE: C++ (GCC 9.2.0)
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
    judge0Id: 62, // Judge0 CE: Java (OpenJDK 13.0.1)
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
