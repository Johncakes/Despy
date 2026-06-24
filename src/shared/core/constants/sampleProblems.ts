/**
 * sampleProblems.ts — 시드 샘플 문제
 *
 * 저장된 문제가 하나도 없을 때(첫 실행) problemStore의 초기값으로 사용한다.
 * 교수 UI 없이도 학생 풀이 화면을 즉시 체험할 수 있게 해주는 데모 데이터다.
 *
 * 사용처: shared/core/stores/problemStore (초기 상태)
 */
import type { Problem } from '@/shared/core/types';
import { DEFAULT_AI_POLICY } from '@/shared/core/constants/aiPolicy';

export const SAMPLE_PROBLEMS: Problem[] = [
  {
    id: 'sample-two-sum',
    title: '두 수의 합',
    statement: [
      '정수 배열과 목표값이 주어질 때, 더해서 목표값이 되는 **두 원소의 인덱스**를',
      '오름차순으로 출력하라. 정답은 유일하다고 가정한다.',
      '',
      '예) 배열 `[2, 7, 11, 15]`, 목표값 `9` → `0 1`',
    ].join('\n'),
    inputFormat: [
      '- 첫째 줄: 원소 개수 N (2 ≤ N ≤ 10,000)',
      '- 둘째 줄: 공백으로 구분된 N개의 정수',
      '- 셋째 줄: 목표값 T',
    ].join('\n'),
    outputFormat: '더해서 T가 되는 두 인덱스를 오름차순으로 공백 구분해 출력한다.',
    timeLimitSec: 2,
    memoryLimitMb: 256,
    allowedLanguageIds: ['python', 'javascript', 'cpp', 'java'],
    testCases: [
      {
        id: 'tc-1',
        input: '4\n2 7 11 15\n9\n',
        expectedOutput: '0 1\n',
        isPublic: true,
      },
      {
        id: 'tc-2',
        input: '3\n3 2 4\n6\n',
        expectedOutput: '1 2\n',
        isPublic: true,
      },
      {
        id: 'tc-3',
        input: '2\n3 3\n6\n',
        expectedOutput: '0 1\n',
        isPublic: false,
      },
    ],
    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'sample-valid-parentheses',
    title: '올바른 괄호 문자열',
    statement: [
      '`()`, `{}`, `[]` 세 종류의 괄호로만 이루어진 문자열이 주어진다.',
      '여는 괄호와 닫는 괄호가 **올바르게 짝지어지고 중첩**되었는지 판별하라.',
      '',
      '- 모든 닫는 괄호는 같은 종류의 여는 괄호와 짝지어져야 한다.',
      '- 짝은 올바른 순서로 닫혀야 한다. 예) `([)]`는 올바르지 않다.',
      '',
      '예) `{[()]}` → `YES`, `([)]` → `NO`',
    ].join('\n'),
    inputFormat: [
      '- 첫째 줄: 괄호로만 이루어진 문자열 S (1 ≤ |S| ≤ 10,000)',
      "- S는 `(`, `)`, `{`, `}`, `[`, `]` 문자로만 구성된다.",
    ].join('\n'),
    outputFormat: '올바른 괄호 문자열이면 `YES`, 아니면 `NO`를 출력한다.',
    timeLimitSec: 1,
    memoryLimitMb: 256,
    allowedLanguageIds: ['python', 'javascript', 'cpp', 'java'],
    testCases: [
      {
        id: 'tc-1',
        input: '()[]{}\n',
        expectedOutput: 'YES\n',
        isPublic: true,
      },
      {
        id: 'tc-2',
        input: '([)]\n',
        expectedOutput: 'NO\n',
        isPublic: true,
      },
      {
        id: 'tc-3',
        input: '{[()]}\n',
        expectedOutput: 'YES\n',
        isPublic: false,
      },
      {
        id: 'tc-4',
        input: '(((\n',
        expectedOutput: 'NO\n',
        isPublic: false,
      },
    ],
    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'sample-max-subarray',
    title: '연속 부분 수열의 최대 합',
    statement: [
      '정수 배열이 주어질 때, **연속한** 부분 수열의 합 중 최댓값을 구하라.',
      '부분 수열은 비어 있을 수 없으며, 적어도 하나의 원소를 포함한다.',
      '',
      '예) 배열 `[-2, 1, -3, 4, -1, 2, 1, -5, 4]`에서 `[4, -1, 2, 1]`의 합 `6`이 최대다.',
    ].join('\n'),
    inputFormat: [
      '- 첫째 줄: 원소 개수 N (1 ≤ N ≤ 100,000)',
      '- 둘째 줄: 공백으로 구분된 N개의 정수 (-1,000 ≤ aᵢ ≤ 1,000)',
    ].join('\n'),
    outputFormat: '연속 부분 수열의 합 중 최댓값을 출력한다.',
    timeLimitSec: 2,
    memoryLimitMb: 256,
    allowedLanguageIds: ['python', 'javascript', 'cpp', 'java'],
    testCases: [
      {
        id: 'tc-1',
        input: '9\n-2 1 -3 4 -1 2 1 -5 4\n',
        expectedOutput: '6\n',
        isPublic: true,
      },
      {
        id: 'tc-2',
        input: '1\n-5\n',
        expectedOutput: '-5\n',
        isPublic: true,
      },
      {
        id: 'tc-3',
        input: '5\n1 2 3 4 5\n',
        expectedOutput: '15\n',
        isPublic: false,
      },
      {
        id: 'tc-4',
        input: '4\n-1 -2 -3 -4\n',
        expectedOutput: '-1\n',
        isPublic: false,
      },
    ],
    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
];
