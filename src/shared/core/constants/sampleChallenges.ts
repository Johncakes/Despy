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
  EXPRESS_TODO_API_TEMPLATE,
  EXPRESS_TODO_API_LOCKED_PATHS,
  FULLSTACK_TODO_TEMPLATE,
  FULLSTACK_TODO_LOCKED_PATHS,
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
          rationale: '동작은 테스트로 검증되므로, 루브릭은 유지보수성에 배점한다.',
          // 점수 레벨 anchor 예시 — AI 점수가 아래 값 중 하나로 스냅된다(채점 근거 명확화).
          levels: [
            { score: 15, descriptor: '상태가 최소이고 파생값을 중복 없이 계산한다.' },
            { score: 8, descriptor: '동작하나 불필요한 상태·중복이 일부 있다.' },
            { score: 0, descriptor: '상태 관리가 장황하거나 중복이 많다.' },
          ],
        },
      ],
      // testFiles가 아직 비어 있으므로 초기엔 루브릭 비중을 높게 둔다(P2에서 재조정).
      weights: { tests: 0.3, rubric: 0.7 },
    },

    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'sample-counter-decrement',
    title: '카운터에 "감소" 버튼 바이브코딩',
    statement: [
      '주어진 Vite + React 앱에는 증가 버튼만 있는 카운터가 있습니다.',
      'AI 도우미를 활용해 **"감소" 버튼**을 추가하세요.',
      '',
      '### 요구사항',
      "- `src/App.jsx`에 텍스트가 `감소`인 버튼을 추가한다.",
      '- 그 버튼을 누르면 카운터가 `1` 줄어든다(음수도 허용).',
      '- 기존 증가 버튼은 그대로 동작해야 한다.',
      '',
      '### 계약 (자동 채점이 의존하는 약속)',
      "- 감소 버튼의 텍스트는 정확히 `감소` 여야 한다.",
      '- 빌드 설정(`vite.config.js`)·HTML 셸·`package.json`은 **잠겨 있어** 수정할 수 없다.',
    ].join('\n'),

    template: VITE_REACT_SAMPLE_TEMPLATE,
    lockedPaths: [...VITE_REACT_SAMPLE_LOCKED_PATHS],
    editablePaths: ['src/App.jsx', 'src/index.css'],

    setupCommands: ['npm install'],
    devCommand: 'npm run dev',
    testCommand: 'npm test',

    // P2에서 실제 채점 테스트로 대체. 지금은 빈 트리.
    testFiles: {},
    rubric: {
      criteria: [
        {
          id: 'decrement-button-exists',
          description: '"감소" 버튼이 존재하고 클릭하면 카운터가 1 줄어든다.',
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
      weights: { tests: 0.3, rubric: 0.7 },
    },

    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'sample-counter-parity',
    title: '카운터에 짝/홀 표시 바이브코딩',
    statement: [
      '주어진 Vite + React 앱에는 증가 버튼만 있는 카운터가 있습니다.',
      'AI 도우미를 활용해 현재 카운터 값이 **짝수인지 홀수인지** 화면에 표시하세요.',
      '',
      '### 요구사항',
      "- `src/App.jsx`에 현재 값이 짝수면 `짝수`, 홀수면 `홀수`라는 텍스트를 보여준다.",
      '- 카운터 값이 바뀌면 표시도 즉시 갱신되어야 한다.',
      '- 기존 증가 버튼은 그대로 동작해야 한다.',
      '',
      '### 계약 (자동 채점이 의존하는 약속)',
      "- 표시 텍스트는 정확히 `짝수` 또는 `홀수` 여야 한다(초기값 0은 `짝수`).",
      '- 빌드 설정(`vite.config.js`)·HTML 셸·`package.json`은 **잠겨 있어** 수정할 수 없다.',
    ].join('\n'),

    template: VITE_REACT_SAMPLE_TEMPLATE,
    lockedPaths: [...VITE_REACT_SAMPLE_LOCKED_PATHS],
    editablePaths: ['src/App.jsx', 'src/index.css'],

    setupCommands: ['npm install'],
    devCommand: 'npm run dev',
    testCommand: 'npm test',

    // P2에서 실제 채점 테스트로 대체. 지금은 빈 트리.
    testFiles: {},
    rubric: {
      criteria: [
        {
          id: 'parity-label-correct',
          description: '현재 값에 따라 `짝수`/`홀수` 텍스트가 정확히 표시된다.',
          maxScore: 55,
        },
        {
          id: 'updates-on-change',
          description: '값이 바뀔 때 표시가 즉시 갱신되고 증가 버튼이 정상 동작한다.',
          maxScore: 30,
        },
        {
          id: 'code-quality',
          description: '파생 값을 불필요한 상태 없이 단순하게 계산한다.',
          maxScore: 15,
        },
      ],
      weights: { tests: 0.3, rubric: 0.7 },
    },

    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'sample-express-todo-api',
    title: 'Todo API에 "할 일 추가" 엔드포인트 바이브코딩',
    statement: [
      '주어진 Express Todo API에는 목록 조회(`GET /todos`)만 구현돼 있습니다.',
      'AI 도우미를 활용해 **할 일을 추가하는 `POST /todos` 엔드포인트**를 구현하세요.',
      '',
      '### 요구사항',
      '- `src/app.js`의 `createApp(db)` 안에 `POST /todos` 라우트를 추가한다.',
      '- 요청 body의 `{ title }`을 주어진 저장소 `db.addTodo(title)`로 추가한다.',
      '- `db.addTodo`가 돌려준 새 항목(`{ id, title, done: false }`)을 반환한다.',
      '- 성공 시 상태 코드 `201`과 생성된 항목(JSON)을 반환한다.',
      '- 기존 `GET /todos`는 그대로 동작해야 한다.',
      '',
      '### 실시간으로 확인하기',
      '- **API 콘솔** 탭에서 `POST /todos`를 직접 보내 응답을 확인한다.',
      '- **API 로그** 탭에서 방금 보낸 요청/응답이 실시간으로 쌓이는지 본다.',
      '- **DB 상태** 탭에서 저장소(`db.json`)에 새 항목이 추가되는지 실시간으로 본다.',
      '',
      '### 계약 (자동 채점이 의존하는 약속)',
      '- 채점 스펙은 `src/app.test.js`(supertest)이며 **잠겨 있다** — 통과하도록 구현한다.',
      '- 실행 골격(`src/server.js`)·저장소(`src/db.js`)·의존성(`package.json`)도 **잠겨 있다**.',
      '- 콘솔의 `npm test`로 언제든 통과 여부를 확인할 수 있다(저장소는 db 모듈 — 인메모리로 격리 채점).',
    ].join('\n'),

    template: EXPRESS_TODO_API_TEMPLATE,
    lockedPaths: [...EXPRESS_TODO_API_LOCKED_PATHS],
    editablePaths: ['src/app.js'],

    setupCommands: ['npm install'],
    devCommand: 'npm run dev',
    testCommand: 'npm test',

    // 가시 테스트(app.test.js)가 채점 계약을 겸한다. 서버측 재실행(§7.2)은 후속.
    testFiles: {},
    rubric: {
      criteria: [
        {
          id: 'post-endpoint-works',
          description:
            'POST /todos가 { title }을 받아 201과 생성 항목을 반환하고, 이후 GET 목록에 포함된다.',
          maxScore: 60,
        },
        {
          id: 'get-still-works',
          description: '기존 GET /todos가 여전히 정상 동작한다.',
          maxScore: 20,
        },
        {
          id: 'code-quality',
          description: '라우트 구현이 단순하고 일관되며 불필요한 중복이 없다.',
          maxScore: 20,
        },
      ],
      weights: { tests: 0.3, rubric: 0.7 },
    },

    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'sample-fullstack-todo',
    title: '풀스택 Todo — 프론트 폼 + 백엔드 POST 바이브코딩',
    statement: [
      '한 컨테이너에서 프론트(Vite+React)와 백(Express)이 함께 돕니다. 프론트의 "추가" 폼은',
      '이미 `POST /api/todos`를 호출하지만, **백엔드에 그 엔드포인트가 없어** 아직 동작하지 않습니다.',
      'AI 도우미를 활용해 **`POST /api/todos`(백엔드)를 구현**해 폼이 실제로 동작하게 만드세요.',
      '',
      '### 요구사항',
      '- `server/app.js`의 `createApp(db)` 안에 `POST /api/todos` 라우트를 추가한다.',
      '- 요청 body의 `{ title }`을 주어진 저장소 `db.addTodo(title)`로 추가한다.',
      '- `db.addTodo`가 돌려준 새 항목을 상태 코드 `201`과 함께 JSON으로 반환한다.',
      '- 구현하면 미리보기의 "추가" 버튼이 즉시 동작한다(프론트→Vite proxy→Express).',
      '',
      '### 실시간으로 확인하기',
      '- **API 로그** 탭: 프론트가 보낸 `GET`/`POST` 요청·응답이 실시간으로 쌓인다.',
      '- **DB 상태** 탭: 저장소(`db.json`)에 추가한 할 일이 실시간으로 반영된다.',
      '',
      '### 계약 (자동 채점이 의존하는 약속)',
      '- 백엔드 채점 스펙은 `server/app.test.js`(supertest), 프론트는 `src/App.test.jsx`이며 **둘 다 잠겨 있다**.',
      '- 빌드/실행 설정·`server/index.js`·저장소(`server/db.js`)도 **잠겨 있어** 수정할 수 없다.',
      '- 콘솔의 `npm test`로 프론트·백 양쪽 통과 여부를 한 번에 확인할 수 있다(채점은 인메모리 db로 격리).',
    ].join('\n'),

    template: FULLSTACK_TODO_TEMPLATE,
    lockedPaths: [...FULLSTACK_TODO_LOCKED_PATHS],
    editablePaths: ['server/app.js', 'src/App.jsx', 'src/index.css'],

    setupCommands: ['npm install'],
    devCommand: 'npm run dev',
    testCommand: 'npm test',

    // 가시 테스트(App.test.jsx·app.test.js)가 채점 계약을 겸한다. 서버측 재실행(§7.2)은 후속.
    testFiles: {},
    rubric: {
      criteria: [
        {
          id: 'post-endpoint-works',
          description:
            'POST /api/todos가 { title }을 받아 201과 생성 항목을 반환하고, 이후 GET 목록에 포함된다.',
          maxScore: 55,
        },
        {
          id: 'frontend-wires-up',
          description:
            '프론트의 "추가" 폼이 백엔드와 연결되어, 추가한 항목이 화면 목록에 즉시 반영된다.',
          maxScore: 25,
        },
        {
          id: 'code-quality',
          description: '프론트·백 라우트 구현이 단순하고 일관되며 불필요한 중복이 없다.',
          maxScore: 20,
        },
      ],
      weights: { tests: 0.4, rubric: 0.6 },
    },

    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  },
];
