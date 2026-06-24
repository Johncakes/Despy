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
];
