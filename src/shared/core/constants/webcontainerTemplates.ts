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
 * 나아가 **풀스택 과제 템플릿**(FULLSTACK_TODO_TEMPLATE)은 한 컨테이너에서 프론트(Vite)와
 * 백(Express)을 concurrently로 동시에 띄우고 Vite proxy(/api → :3000)로 묶는다. 두 포트가
 * server-ready를 내므로 미리보기는 프론트 포트(FULLSTACK_PREVIEW_PORT)로 확정한다
 * (useWorkspace가 startDevServer(previewPort)에 전달). 채점은 한 번의 npm test로 프론트
 * (happy-dom)와 백(node 도크블록 + supertest) 두 계층을 함께 검증한다.
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
 * 최소 Express + 파일 백업 Todo API 스타터 (경로→파일 내용 평면 맵).
 *
 * 외부 DB·외부 네트워크 없이 자기완결형으로 동작한다. 저장소는 잠긴 `db` 모듈이며,
 * dev 서버는 파일 백업(src/data/db.json — 세션 내 영속)을, 테스트는 인메모리(격리)를
 * 주입한다(`createApp(db)` DI). dev 서버는 학생 앱을 로깅 미들웨어로 감싸 요청/응답을
 * stdout 센티넬로 흘리고(→ 호스트 'API 로그'), db는 매 쓰기마다 파일에 기록한다
 * (→ 호스트가 fs.watch로 'DB 상태' 실시간 표시). `node --watch`로 편집 시 자동 재시작.
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
        // --watch: src 변경 시 서버 자동 재시작(편집 → 즉시 반영). db.json은 import가
        // 아니라 fs로 읽으므로 watch 대상이 아니다(쓰기→재시작 루프 없음).
        dev: 'node --watch src/server.js',
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

// 주어진 앱 팩토리 — db는 server.js(파일 백업) 또는 테스트(인메모리)가 주입한다.
// 라우트는 db.todos(목록)·db.addTodo(title)(추가)로 저장소를 다룬다.
export function createApp(db) {
  const app = express();
  app.use(express.json());

  // 미리보기/상태 확인용 루트. 수정하지 않아도 된다.
  app.get('/', (req, res) => {
    res.json({ status: 'ok', endpoints: ['GET /todos', 'POST /todos'] });
  });

  // 할 일 목록 조회 — 이미 구현되어 있다.
  app.get('/todos', (req, res) => {
    res.json(db.todos);
  });

  // TODO: POST /todos 를 구현하세요.
  //  - 요청 body의 { title }을 db.addTodo(title)로 추가한다.
  //  - addTodo가 돌려준 새 항목을 상태 코드 201과 함께 JSON으로 반환한다.
  //  - 구현하면 'API 로그'에 요청/응답이, 'DB 상태'에 새 항목이 실시간 표시된다.

  return app;
}
`,

  // 저장소 모듈(잠금) — 파일 백업/인메모리 두 변형을 제공한다. 학생은 db API만 쓴다.
  'src/db.js': `import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

// 시드 — 최초 상태(파일이 없을 때 1회 기록).
function seed() {
  return {
    todos: [
      { id: 1, title: '우유 사기', done: false },
      { id: 2, title: '운동하기', done: true },
    ],
    nextId: 3,
  };
}

// 공통 저장소 동작 — load/save 주입으로 파일/인메모리 변형을 만든다.
function makeDb(load, save) {
  const state = load();
  return {
    // 현재 할 일 목록(읽기용).
    get todos() {
      return state.todos;
    },
    // 새 할 일을 추가하고 저장한다(파일 백업이면 디스크 기록 → 호스트가 'DB 상태'로 표시).
    addTodo(title) {
      const todo = { id: state.nextId++, title, done: false };
      state.todos.push(todo);
      save(state);
      return todo;
    },
    // todos를 직접 수정했을 때 호출해 저장/반영한다(선택).
    save() {
      save(state);
    },
  };
}

// 파일 백업 저장소 — JSON 파일에 영속한다(세션 내 유지 + 호스트 watch 대상).
export function createFileDb(path) {
  const save = (state) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2));
  };
  const load = () => {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        /* 깨졌으면 시드로 재생성 */
      }
    }
    const initial = seed();
    save(initial);
    return initial;
  };
  return makeDb(load, save);
}

// 인메모리 저장소 — 파일 없이 매번 새 시드로 시작한다(테스트 격리용).
export function createMemoryDb() {
  return makeDb(seed, () => {});
}
`,

  // 미리보기용 dev 서버(잠금) — 파일 백업 db 주입 + 요청 로깅 미들웨어로 학생 앱을 감싼다.
  'src/server.js': `import express from 'express';
import { createApp } from './app.js';
import { createFileDb } from './db.js';

// 파일 백업 DB — src/data/db.json에 저장된다(호스트가 watch해 'DB 상태'를 실시간 표시).
const db = createFileDb('src/data/db.json');

// 학생 앱을 감싸 요청/응답을 로깅한다(stdout → 호스트 'API 로그'). express.json은 로거가
// 요청 바디를 읽도록 학생 앱보다 먼저 둔다(이중 파싱은 무해).
const app = express();
app.use(express.json());
app.use(despyRequestLogger);
app.use(createApp(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('despy todo API listening on http://localhost:' + PORT);
});

// 요청 1건의 메서드/경로/상태/소요/요청·응답 바디를 센티넬 JSON 한 줄로 출력한다.
// 호스트(useWorkspace)가 dev 출력에서 이 줄만 파싱해 'API 로그'로 보여준다.
function despyRequestLogger(req, res, next) {
  const started = Date.now();
  let resBody;
  const json = res.json.bind(res);
  res.json = (payload) => {
    resBody = payload;
    return json(payload);
  };
  res.on('finish', () => {
    const entry = {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Date.now() - started,
      reqBody: req.body && Object.keys(req.body).length ? req.body : undefined,
      resBody,
    };
    try {
      process.stdout.write('__DESPY_LOG__' + JSON.stringify(entry) + '__DESPY_LOG_END__\\n');
    } catch {
      /* 직렬화 불가한 응답은 로그를 건너뛴다 */
    }
  });
  next();
}
`,

  // 채점 계약(스펙) — supertest로 앱을 인프로세스에 올려 HTTP 행동을 검증한다(잠금).
  // 각 테스트는 인메모리 db로 격리한다(파일 백업과 달리 상태가 섞이지 않는다).
  'src/app.test.js': `import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { createMemoryDb } from './db.js';

const makeApp = () => createApp(createMemoryDb());

describe('Todo API', () => {
  it('GET /todos는 할 일 목록(배열)을 반환한다', async () => {
    const res = await request(makeApp()).get('/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /todos는 새 할 일을 추가하고 201로 응답한다', async () => {
    const res = await request(makeApp())
      .post('/todos')
      .send({ title: '책 읽기' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: '책 읽기', done: false });
    expect(typeof res.body.id).toBe('number');
  });

  it('POST 후 GET 목록에 추가한 항목이 포함된다', async () => {
    const app = makeApp();
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
 * package.json(빌드/의존성)·server.js(실행 골격+로깅)·db.js(저장소 모듈)·app.test.js
 * (채점 계약)는 잠그고, 라우트 정의(src/app.js)만 편집 가능하게 한다. 채점 스펙을 잠가
 * 무결성(테스트 변조 방지)을 지킨다.
 */
export const EXPRESS_TODO_API_LOCKED_PATHS: readonly string[] = [
  'package.json',
  'src/server.js',
  'src/db.js',
  'src/app.test.js',
];

// ── 풀스택(프론트 Vite + 백 Express, 단일 컨테이너) 과제 템플릿 ─────────────────

/**
 * 풀스택 템플릿에서 미리보기로 노출할 프론트(Vite) 포트.
 *
 * 한 컨테이너에서 프론트(Vite)와 백(Express)을 동시에 띄우면 포트마다 server-ready가
 * 발생하므로, 미리보기 iframe에 꽂을 프론트 포트를 이 상수로 고정한다(vite.config.js의
 * server.port와 일치). 백엔드(3000)는 Vite proxy 뒤로만 쓰이므로 미리보기 URL이 없다.
 * useWorkspace가 startDevServer(previewPort)로 이 포트를 골라 미리보기를 확정한다.
 */
export const FULLSTACK_PREVIEW_PORT = 5173;

/**
 * 풀스택 Todo 스타터 (프론트 Vite+React + 백 Express, 단일 컨테이너 · 경로→파일 평면 맵).
 *
 * 한 WebContainer 안에서 `concurrently`로 백(Express :3000)과 프론트(Vite :5173)를 동시에
 * 띄우고, Vite proxy가 프론트의 `/api/*`를 같은 컨테이너의 Express로 전달한다(same-origin —
 * CORS 없음, 실제 배포 구조와 동일). 미리보기는 프론트(Vite)만 노출하고, 학생이 프론트 UI를
 * 조작하면 그게 자기 백엔드 API를 때려 결과가 실시간으로 화면에 반영된다.
 *
 * 저장소는 잠긴 `db` 모듈(server/db.js)이며 dev 서버는 파일 백업(server/data/db.json —
 * 세션 영속 + 호스트가 fs.watch로 'DB 상태' 표시), 테스트는 인메모리(격리)를 주입한다
 * (`createApp(db)` DI). dev 서버는 학생 앱을 로깅 미들웨어로 감싸 요청/응답을 stdout
 * 센티넬로 흘리고(→ 호스트 'API 로그'), `node --watch`로 편집 시 자동 재시작한다.
 * 채점은 두 계층을 한 번의 `npm test`로 검증한다:
 *   - 프론트(src/App.test.jsx): happy-dom 환경 + fetch 목으로 렌더/목록 표시 검증
 *   - 백엔드(server/app.test.js): `// @vitest-environment node` 도크블록으로 node 환경,
 *     supertest로 앱을 인프로세스에 올려 HTTP 행동 검증(채점 계약 — 잠금)
 *
 * 스타터에는 `GET /api/todos`만 구현돼 있고, `POST /api/todos`(백)는 학생이 채워야 한다
 * (프론트의 "추가" 폼은 이미 POST를 호출하므로, 백엔드를 구현하면 즉시 동작한다).
 */
export const FULLSTACK_TODO_TEMPLATE: ProjectFiles = {
  'package.json': JSON.stringify(
    {
      name: 'despy-fullstack-todo',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        // 한 컨테이너에서 백(Express)·프론트(Vite)를 동시에 띄운다. -k 미사용:
        // 한쪽이 죽어도 다른 쪽은 살려 미리보기/피드백을 유지한다. 백엔드는 --watch로
        // server 변경 시 자동 재시작(편집 → 즉시 반영). 프론트는 Vite HMR로 갱신된다.
        dev: 'concurrently -n api,web "node --watch server/index.js" "vite"',
        test: 'vitest run',
      },
      dependencies: {
        express: '^4.21.2',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@testing-library/dom': '^10.4.0',
        '@testing-library/jest-dom': '^6.6.3',
        '@testing-library/react': '^16.0.1',
        '@vitejs/plugin-react': '^4.3.4',
        concurrently: '^9.1.0',
        'happy-dom': '^15.11.7',
        supertest: '^7.0.0',
        vite: '^5.4.10',
        vitest: '^2.1.8',
      },
    },
    null,
    2,
  ),

  // 프론트(Vite) 설정 — 포트 고정 + /api 프록시(같은 컨테이너의 Express로 전달). 잠금.
  'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// WebContainer 안에서 프론트(Vite)와 백(Express)을 한 컨테이너에서 동시에 띄운다.
// 프론트의 /api/* 요청은 같은 컨테이너의 Express(localhost:3000)로 프록시된다(same-origin).
// 포트를 5173으로 고정(strictPort)해 미리보기 확정 포트(FULLSTACK_PREVIEW_PORT)와 맞춘다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
`,

  // Vitest 설정 — 프론트 테스트는 happy-dom 환경. 백엔드 테스트(server/app.test.js)는
  // 파일 상단 `// @vitest-environment node` 도크블록으로 node 환경을 개별 지정한다.
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

  'vitest.setup.js': `import '@testing-library/jest-dom';
`,

  'index.html': `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>despy · 풀스택 Todo</title>
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

  // 프론트 주 작업 영역 — 같은 컨테이너의 Express API(/api/todos)를 호출한다.
  // 마운트 시 GET으로 목록을 불러오고, "추가" 폼은 POST를 호출한다(백엔드 구현 시 동작).
  'src/App.jsx': `import { useEffect, useState } from 'react';

const API = '/api/todos';

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);

  async function loadTodos() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('목록을 불러오지 못했습니다 (' + res.status + ').');
      setTodos(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadTodos();
  }, []);

  async function handleAdd(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        throw new Error('추가 실패 (' + res.status + '). 백엔드 POST /api/todos를 구현했나요?');
      }
      setTitle('');
      await loadTodos();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="app">
      <h1>despy ✅ 풀스택 Todo</h1>
      <p>이 화면(프론트)은 같은 컨테이너의 Express API(<code>/api/todos</code>)를 호출합니다.</p>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="할 일을 입력하세요"
          aria-label="할 일 제목"
        />
        <button type="submit">추가</button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            {todo.title}
          </li>
        ))}
      </ul>

      <p className="hint">
        src/App.jsx(프론트)와 server/app.js(백엔드)를 수정하면 미리보기가 즉시 갱신됩니다.
      </p>
    </main>
  );
}
`,

  // 프론트 행동 테스트(잠금) — 마운트 시 GET 결과를 목록에 표시하는지 검증한다.
  // 실제 네트워크 대신 fetch를 가짜로 대체해 API 구동과 무관하게 프론트만 검증한다.
  'src/App.test.jsx': `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, title: '우유 사기', done: false }],
    })),
  );
});

describe('App (프론트)', () => {
  it('제목 헤딩을 렌더링한다', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('마운트 시 API에서 불러온 할 일을 목록에 표시한다', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('우유 사기')).toBeInTheDocument());
  });
});
`,

  // 백엔드 주 작업 영역 — 라우트 정의. POST /api/todos를 여기에 구현한다.
  'server/app.js': `import express from 'express';

// 주어진 앱 팩토리 — db는 server/index.js(파일 백업) 또는 테스트(인메모리)가 주입한다.
// 라우트는 db.todos(목록)·db.addTodo(title)(추가)로 저장소를 다룬다.
export function createApp(db) {
  const app = express();
  app.use(express.json());

  // 할 일 목록 조회 — 이미 구현되어 있다(프론트가 마운트 시 호출).
  app.get('/api/todos', (req, res) => {
    res.json(db.todos);
  });

  // TODO: POST /api/todos 를 구현하세요.
  //  - 요청 body의 { title }을 db.addTodo(title)로 추가한다.
  //  - addTodo가 돌려준 새 항목을 상태 코드 201과 함께 JSON으로 반환한다.
  //  - 구현하면 프론트 "추가" 버튼이 동작하고, 'API 로그'·'DB 상태'에 실시간 표시된다.

  return app;
}
`,

  // 저장소 모듈(잠금) — 파일 백업/인메모리 두 변형을 제공한다. 학생은 db API만 쓴다.
  'server/db.js': `import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

// 시드 — 최초 상태(파일이 없을 때 1회 기록).
function seed() {
  return {
    todos: [
      { id: 1, title: '우유 사기', done: false },
      { id: 2, title: '운동하기', done: true },
    ],
    nextId: 3,
  };
}

// 공통 저장소 동작 — load/save 주입으로 파일/인메모리 변형을 만든다.
function makeDb(load, save) {
  const state = load();
  return {
    // 현재 할 일 목록(읽기용).
    get todos() {
      return state.todos;
    },
    // 새 할 일을 추가하고 저장한다(파일 백업이면 디스크 기록 → 호스트가 'DB 상태'로 표시).
    addTodo(title) {
      const todo = { id: state.nextId++, title, done: false };
      state.todos.push(todo);
      save(state);
      return todo;
    },
    // todos를 직접 수정했을 때 호출해 저장/반영한다(선택).
    save() {
      save(state);
    },
  };
}

// 파일 백업 저장소 — JSON 파일에 영속한다(세션 내 유지 + 호스트 watch 대상).
export function createFileDb(path) {
  const save = (state) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2));
  };
  const load = () => {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        /* 깨졌으면 시드로 재생성 */
      }
    }
    const initial = seed();
    save(initial);
    return initial;
  };
  return makeDb(load, save);
}

// 인메모리 저장소 — 파일 없이 매번 새 시드로 시작한다(테스트 격리용).
export function createMemoryDb() {
  return makeDb(seed, () => {});
}
`,

  // 미리보기용 백엔드 dev 서버(잠금) — 파일 백업 db 주입 + 요청 로깅 미들웨어로 학생 앱을
  // 감싼다. 3000 포트를 열어 Vite proxy(/api → :3000)의 대상이 된다.
  'server/index.js': `import express from 'express';
import { createApp } from './app.js';
import { createFileDb } from './db.js';

// 파일 백업 DB — server/data/db.json에 저장된다(호스트가 watch해 'DB 상태'를 실시간 표시).
const db = createFileDb('server/data/db.json');

// 학생 앱을 감싸 요청/응답을 로깅한다(stdout → 호스트 'API 로그'). express.json은 로거가
// 요청 바디를 읽도록 학생 앱보다 먼저 둔다(이중 파싱은 무해).
const app = express();
app.use(express.json());
app.use(despyRequestLogger);
app.use(createApp(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('despy todo API listening on http://localhost:' + PORT);
});

// 요청 1건의 메서드/경로/상태/소요/요청·응답 바디를 센티넬 JSON 한 줄로 출력한다.
// 호스트(useWorkspace)가 dev 출력에서 이 줄만 파싱해 'API 로그'로 보여준다.
function despyRequestLogger(req, res, next) {
  const started = Date.now();
  let resBody;
  const json = res.json.bind(res);
  res.json = (payload) => {
    resBody = payload;
    return json(payload);
  };
  res.on('finish', () => {
    const entry = {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Date.now() - started,
      reqBody: req.body && Object.keys(req.body).length ? req.body : undefined,
      resBody,
    };
    try {
      process.stdout.write('__DESPY_LOG__' + JSON.stringify(entry) + '__DESPY_LOG_END__\\n');
    } catch {
      /* 직렬화 불가한 응답은 로그를 건너뛴다 */
    }
  });
  next();
}
`,

  // 백엔드 채점 계약(스펙) — node 환경(도크블록)에서 supertest로 HTTP 행동을 검증한다(잠금).
  // 각 테스트는 인메모리 db로 격리한다(파일 백업과 달리 상태가 섞이지 않는다).
  'server/app.test.js': `// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { createMemoryDb } from './db.js';

const makeApp = () => createApp(createMemoryDb());

describe('Todo API (백엔드)', () => {
  it('GET /api/todos는 할 일 목록(배열)을 반환한다', async () => {
    const res = await request(makeApp()).get('/api/todos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /api/todos는 새 할 일을 추가하고 201로 응답한다', async () => {
    const res = await request(makeApp())
      .post('/api/todos')
      .send({ title: '책 읽기' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: '책 읽기', done: false });
    expect(typeof res.body.id).toBe('number');
  });

  it('POST 후 GET 목록에 추가한 항목이 포함된다', async () => {
    const app = makeApp();
    await request(app).post('/api/todos').send({ title: '청소하기' });
    const res = await request(app).get('/api/todos');
    const titles = res.body.map((todo) => todo.title);
    expect(titles).toContain('청소하기');
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

code {
  padding: 2px 6px;
  border-radius: 4px;
  background: #1b1f2a;
  color: #9ec1ff;
  font-size: 13px;
}

.add-form {
  display: flex;
  gap: 8px;
}

.add-form input {
  flex: 1;
  padding: 8px 12px;
  font-size: 15px;
  color: #e6e8ee;
  background: #1b1f2a;
  border: 1px solid #2a3040;
  border-radius: 8px;
}

button {
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

.error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #3a1d22;
  color: #ff9aa6;
  font-size: 13px;
}

.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-list li {
  padding: 10px 14px;
  background: #1b1f2a;
  border-radius: 8px;
}

.todo-list li.done {
  color: #9aa0ac;
  text-decoration: line-through;
}

.hint {
  font-size: 13px;
  color: #9aa0ac;
}
`,
};

/**
 * 풀스택 Todo 스타터에서 학생이 편집할 수 없는(read-only) 경로.
 *
 * 빌드/실행 설정(package.json·vite/vitest config·index.html·main.jsx), 백엔드 실행
 * 골격+로깅(server/index.js)·저장소 모듈(server/db.js), 양쪽 채점 계약(src/App.test.jsx·
 * server/app.test.js)을 잠그고, 프론트 화면(src/App.jsx)·백엔드 라우트(server/app.js)·
 * 스타일(src/index.css)만 편집 가능하게 한다. 채점 스펙을 잠가 무결성을 지킨다.
 */
export const FULLSTACK_TODO_LOCKED_PATHS: readonly string[] = [
  'package.json',
  'vite.config.js',
  'vitest.config.js',
  'vitest.setup.js',
  'index.html',
  'src/main.jsx',
  'src/App.test.jsx',
  'server/index.js',
  'server/db.js',
  'server/app.test.js',
];
