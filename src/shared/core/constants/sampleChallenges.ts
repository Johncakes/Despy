/**
 * sampleChallenges.ts — 시드 샘플 과제 (WebContainer 피벗 모델)
 *
 * 저장된 과제가 하나도 없을 때(첫 실행) challengeStore의 초기값으로 사용한다.
 * 교수 출제 UI(P4) 없이도 학생 워크스페이스 풀이 흐름(P1~P3)을 즉시 체험할 수 있게
 * 해주는 데모 데이터다. 부팅이 검증된 VITE+React 샘플 템플릿을 그대로 재활용한다.
 *
 * ⚠️ testFiles는 P2(자동 채점)에서 vitest + testing-library 의존성과 함께 실제
 *    채점 테스트로 채운다. 현재는 빈 트리(채점은 P3 루브릭 비중 위주로 시작).
 *
 * 사용처: shared/core/stores/challengeStore (초기 상태)
 */
import type { ChallengeProblem } from '@/shared/core/types';
import { DEFAULT_AI_POLICY } from '@/shared/core/constants/aiPolicy';
import {
  VITE_REACT_SAMPLE_TEMPLATE,
  VITE_REACT_SAMPLE_LOCKED_PATHS,
} from '@/shared/core/constants/webcontainerTemplates';

export const SAMPLE_CHALLENGES: ChallengeProblem[] = [
  {
    id: 'sample-counter-vibe',
    title: '카운터에 "초기화" 기능 바이브코딩',
    statement: [
      '주어진 Vite + React 앱에는 증가 버튼만 있는 카운터가 있습니다.',
      'AI 도우미를 활용해 **"초기화" 버튼**을 추가하세요.',
      '',
      '### 요구사항',
      "- `src/App.jsx`에 텍스트가 `초기화`인 버튼을 추가한다.",
      '- 그 버튼을 누르면 카운터가 `0`으로 돌아간다.',
      '- 기존 증가 버튼은 그대로 동작해야 한다.',
      '',
      '### 계약 (자동 채점이 의존하는 약속)',
      "- 초기화 버튼의 텍스트는 정확히 `초기화` 여야 한다.",
      '- 빌드 설정(`vite.config.js`)·HTML 셸·`package.json`은 **잠겨 있어** 수정할 수 없다.',
    ].join('\n'),

    template: VITE_REACT_SAMPLE_TEMPLATE,
    lockedPaths: [...VITE_REACT_SAMPLE_LOCKED_PATHS],
    editablePaths: ['src/App.jsx', 'src/index.css'],

    setupCommands: ['npm install'],
    devCommand: 'npm run dev',
    testCommand: 'npm test',

    // P2에서 실제 채점 테스트(Cart.test.jsx 등)로 대체. 지금은 빈 트리.
    testFiles: {},
    rubric: {
      criteria: [
        {
          id: 'reset-button-exists',
          description: '"초기화" 버튼이 존재하고 클릭하면 카운터가 0이 된다.',
          maxScore: 60,
        },
        {
          id: 'increment-still-works',
          description: '기존 증가 버튼이 여전히 정상 동작한다.',
          maxScore: 25,
        },
        {
          id: 'code-quality',
          description: '상태 관리가 단순하고 불필요한 중복이 없다.',
          maxScore: 15,
        },
      ],
      // testFiles가 아직 비어 있으므로 초기엔 루브릭 비중을 높게 둔다(P2에서 재조정).
      weights: { tests: 0.3, rubric: 0.7 },
    },

    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
];
