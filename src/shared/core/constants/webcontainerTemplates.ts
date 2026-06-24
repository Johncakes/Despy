/**
 * webcontainerTemplates.ts — WebContainer 부팅 검증용 샘플 프로젝트 템플릿
 *
 * WebContainer가 실제로 부팅→mount→npm install→npm run dev→미리보기까지 도는지
 * 확인하기 위한 최소 Vite + React 스타터다. COEP(require-corp)에 걸리지 않도록
 * **외부 CDN·웹폰트 없이** 시스템 폰트·로컬 스타일만 쓴다.
 *
 * P2(자동 채점)에서 Vitest + Testing Library + happy-dom 테스트 스택과 행동 기준
 * 샘플 테스트(`src/App.test.jsx`)를 추가했다. 이 때문에 npm install이 P0/P1보다
 * 느려지지만(테스트 의존성 설치), `npm test`로 자동 테스트 결과를 캡처할 수 있다.
 *
 * 본 출제용 프리셋 템플릿은 후속 단계(P4 출제 도구)에서 별도로 확장한다.
 *
 * 프론트(Vite+React) 외에 **백엔드(Express) 과제 템플릿**(EXPRESS_TODO_API_TEMPLATE)도
 * 여기 둔다. WebContainer 런타임은 서버 종류를 가리지 않아(server-ready는 포트를 여는
 * 모든 프로세스에서 발생), Express 앱도 동일하게 npm install→dev(listen)→미리보기로
 * 돈다. 채점은 Vitest + supertest(앱을 인프로세스로 올려 HTTP 검증)로 한다.
 *
 * 사용처: features/solve/WorkspacePlaygroundView(PoC), sampleChallenges(샘플 과제)
 */
import type { ProjectFiles } from '@/shared/core/types';

/** 최소 Vite + React 샘플 프로젝트 (경로→파일 내용 평면 맵) */
export const VITE_REACT_SAMPLE_TEMPLATE: ProjectFiles = {
  'package.json': JSON.stringify(
    {
      name: 'despy-webcontainer-poc',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        test: 'vitest run',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@testing-library/dom': '^10.4.0',
        '@testing-library/jest-dom': '^6.6.3',
        '@testing-library/react': '^16.0.1',
        '@vitejs/plugin-react': '^4.3.4',
        'happy-dom': '^15.11.7',
        vite: '^5.4.10',
        vitest: '^2.1.8',
      },
    },
    null,
    2,
  ),

  'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// WebContainer 안에서 도는 Vite 설정 — 추가 설정 없이 기본값으로 동작한다.
export default defineConfig({
  plugins: [react()],
});
`,

  // Vitest 설정(자동 채점). vitest.config가 있으면 vite.config 대신 이 설정을 쓰므로
  // JSX 변환용 react 플러그인을 여기에도 둔다. happy-dom으로 DOM 환경을 띄운다.
  'vitest.config.js': `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
  },
});
`,

  // @testing-library/jest-dom 매처(toBeInTheDocument 등)를 전역 expect에 확장한다.
  'vitest.setup.js': `import '@testing-library/jest-dom';
`,

  'index.html': `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>despy · WebContainer PoC</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,

  'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,

  'src/App.jsx': `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <h1>despy 🚀 WebContainer</h1>
      <p>이 화면은 브라우저 안의 Node 런타임(WebContainer)에서 실행되는 Vite + React 앱입니다.</p>
      <button onClick={() => setCount((value) => value + 1)}>
        count is {count}
      </button>
      <p className="hint">src/App.jsx를 수정하면 미리보기가 즉시 갱신됩니다 (HMR).</p>
    </main>
  );
}
`,

  // 행동(behavior) 기준 샘플 테스트(§3.4) — 내부 구현이 아니라 사용자에게 보이는 결과를
  // 검증한다. 스타터 App.jsx에서 통과하며, P2 자동 테스트 캡처를 데모한다.
  'src/App.test.jsx': `import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('제목 헤딩을 렌더링한다', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('버튼을 누르면 카운트가 1 증가한다', () => {
    render(<App />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('count is 0');
    fireEvent.click(button);
    expect(button).toHaveTextContent('count is 1');
  });
});
`,

  'src/index.css': `:root {
  color-scheme: dark;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

body {
  margin: 0;
  background: #0f1117;
  color: #e6e8ee;
}

.app {
  max-width: 540px;
  margin: 0 auto;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h1 {
  margin: 0;
  color: #5b8cff;
}

button {
  align-self: flex-start;
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 600;
  color: #0f1117;
  background: #5b8cff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

button:hover {
  background: #7aa1ff;
}

.hint {
  font-size: 13px;
  color: #9aa0ac;
}
`,
};

/**
 * 샘플 템플릿에서 학생이 편집할 수 없는(read-only) 경로.
 *
 * "주어진 설정/골격"을 표현한다 — 빌드 설정·HTML 셸은 잠그고 src/* 만 편집 가능.
 * 본 출제 도구(P4)에서는 과제별 lockedPaths로 대체된다.
 */
export const VITE_REACT_SAMPLE_LOCKED_PATHS: readonly string[] = [
  'package.json',
  'vite.config.js',
  'index.html',
];

// ── 백엔드(Express) 과제 템플릿 ─────────────────────────────────────────────

/**
 * 최소 Express + 인메모리 Todo API 스타터 (경로→파일 내용 평면 맵).
 *
 * 외부 DB·외부 네트워크 없이 자기완결형으로 동작한다(인메모리 — 서버 재시작 시 초기화).
 * `createApp()`이 앱을 만드는 팩토리라, dev 서버(server.js)와 테스트(supertest)가
 * 같은 정의를 공유한다. `npm test`는 Vitest(node 환경)로 supertest 케이스를 돌린다.
 *
 * 스타터에는 `GET /todos`만 구현돼 있고, `POST /todos`는 학생이 채워야 한다(아래
 * 샘플 과제 sample-express-todo-api 참조). app.test.js는 채점 계약(스펙) 역할을 한다.
 */
export const EXPRESS_TODO_API_TEMPLATE: ProjectFiles = {
  'package.json': JSON.stringify(
    {
      name: 'despy-express-todo-api',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'node src/server.js',
        test: 'vitest run',
      },
      dependencies: {
        express: '^4.21.2',
      },
      devDependencies: {
        supertest: '^7.0.0',
        vitest: '^2.1.8',
      },
    },
    null,
    2,
  ),

  // 학생 주 작업 영역 — 라우트 정의. POST /todos를 여기에 구현한다.
  'src/app.js': `import express from 'express';

// 주어진 앱 팩토리 — server.js(미리보기)와 테스트(supertest)가 이 함수로 앱을 만든다.
// 저장소는 인메모리이며, createApp() 호출마다 새 상태로 시작한다(테스트 격리).
export function createApp() {
  const app = express();
  app.use(express.json());

  let nextId = 3;
  const todos = [
    { id: 1, title: '우유 사기', done: false },
    { id: 2, title: '운동하기', done: true },
  ];

  // 미리보기/상태 확인용 루트. 수정하지 않아도 된다.
  app.get('/', (req, res) => {
    res.json({ status: 'ok', endpoints: ['GET /todos', 'POST /todos'] });
  });

  // 할 일 목록 조회 — 이미 구현되어 있다.
  app.get('/todos', (req, res) => {
    res.json(todos);
  });

  // TODO: POST /todos 를 구현하세요.
  //  - 요청 body의 { title }을 받아 새 할 일을 추가한다.
  //  - 새 항목은 { id, title, done: false } 형태이며 id는 자동 증가한다.
  //  - 성공 시 상태 코드 201과 생성된 항목(JSON)을 반환한다.
  //  - 힌트: todos.push(...), nextId 활용, res.status(201).json(...)

  return app;
}
`,

  // 미리보기용 dev 서버(잠금) — 포트를 열어 server-ready 이벤트를 발생시킨다.
  'src/server.js': `import { createApp } from './app.js';

// WebContainer 미리보기를 위해 포트를 연다 — server-ready가 여기서 발생한다.
const PORT = process.env.PORT || 3000;
createApp().listen(PORT, () => {
  console.log('despy todo API listening on http://localhost:' + PORT);
});
`,

  // 채점 계약(스펙) — supertest로 앱을 인프로세스에 올려 HTTP 행동을 검증한다(잠금).
  // GET 테스트는 스타터에서 통과하고, POST 테스트는 학생이 구현해야 통과한다(red→green).
  'src/app.test.js': `import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('Todo API', () => {
  it('GET /todos는 할 일 목록(배열)을 반환한다', async () => {
    const res = await request(createApp()).get('/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /todos는 새 할 일을 추가하고 201로 응답한다', async () => {
    const res = await request(createApp())
      .post('/todos')
      .send({ title: '책 읽기' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: '책 읽기', done: false });
    expect(typeof res.body.id).toBe('number');
  });

  it('POST 후 GET 목록에 추가한 항목이 포함된다', async () => {
    const app = createApp();
    await request(app).post('/todos').send({ title: '청소하기' });
    const res = await request(app).get('/todos');
    const titles = res.body.map((todo) => todo.title);
    expect(titles).toContain('청소하기');
  });
});
`,
};

/**
 * Express 백엔드 스타터에서 학생이 편집할 수 없는(read-only) 경로.
 *
 * package.json(빌드/의존성)·server.js(주어진 실행 골격)·app.test.js(채점 계약)는
 * 잠그고, 라우트 정의(src/app.js)만 편집 가능하게 한다. 채점 스펙(app.test.js)을
 * 잠가 무결성(테스트 변조 방지)을 지킨다.
 */
export const EXPRESS_TODO_API_LOCKED_PATHS: readonly string[] = [
  'package.json',
  'src/server.js',
  'src/app.test.js',
];
