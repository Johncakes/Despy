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
 * 마지막으로 **ML 챌린지 템플릿**(ML_CLASSIFICATION_TEMPLATE·ML_REGRESSION_TEMPLATE)은 dev
 * 서버 없이 pure @tensorflow/tfjs로 모델을 학습/평가한다(WebContainer는 네이티브 바인딩
 * 미지원 → tfjs-node 불가, 순수 JS tfjs만 가능). 학생은 model.mjs(구조·하이퍼파라미터)를
 * 고치고, 잠긴 eval.mjs가 고정 seed로 새로 학습한 뒤 숨겨진 test셋(ML_*_TEST_FILES — 채점
 * 시점에만 주입)으로 점수를 재 __DESPY_SCORE__ 센티넬로 출력한다(runtime.runScoreEval이 파싱).
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
    const button = screen.getByRole('button', { name: /count is/i });
    expect(button).toHaveTextContent('count is 0');
    fireEvent.click(button);
    expect(button).toHaveTextContent('count is 1');
  });

  it('감소 버튼을 누르면 카운트가 1 줄어든다', () => {
    render(<App />);
    const decreaseBtn = screen.getByRole('button', { name: '감소' });
    fireEvent.click(decreaseBtn);
    expect(screen.getByRole('button', { name: /count is/i })).toHaveTextContent('count is -1');
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

// ── ML 챌린지(TensorFlow.js) 템플릿 ──────────────────────────────────────────

/**
 * ML 챌린지 템플릿 — pure @tensorflow/tfjs(네이티브 바인딩 없는 순수 JS)로 브라우저
 * WebContainer 안에서 모델을 학습/평가한다. dev 서버(미리보기)가 없고 점수 패널이 주 화면이다.
 *
 * 파일 구성(분류·회귀 공통 골격):
 *   - data.mjs(잠금): CSV 로더(+회귀는 표준화기). train/test에 동일 적용해 전처리 일관.
 *   - model.mjs(편집): 학생이 모델 구조·하이퍼파라미터를 작성하는 주 작업 영역.
 *   - train.mjs(편집): train.csv로 빠르게 학습해 train 성능을 확인하는 실험 스크립트.
 *   - eval.mjs(잠금): 고정 seed로 새로 학습 → 숨겨진 test셋 점수를 __DESPY_SCORE__ 센티넬로 출력.
 *   - data/train.csv(잠금): 학생 노출 train셋(채점 train을 고정해 공정성 유지).
 *   - package.json(잠금): @tensorflow/tfjs 의존성 + train/eval 스크립트.
 *
 * 숨긴 test셋은 ML_*_TEST_FILES(data/test.csv)로 분리해 ChallengeProblem.testFiles에 담고,
 * 채점(평가) 시점에만 컨테이너에 mount한다(학생 파일트리에 노출 안 됨). 데이터는 시드 고정
 * 합성 데이터다(분류: Iris식 3클래스 4피처, 회귀: 주택가격식 3피처). 점수 변동·데이터 누수
 * 한계는 UI에 명시한다(docs/spec-ml-challenge.md §7).
 */
export const ML_CLASSIFICATION_TEMPLATE: ProjectFiles = {
  'package.json': JSON.stringify(
    {
      name: 'despy-ml-classification',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        train: 'node train.mjs',
        eval: 'node eval.mjs',
      },
      dependencies: {
        '@tensorflow/tfjs': '^4.22.0',
      },
    },
    null,
    2,
  ),

  'README.md': `# 분류 챌린지 (Iris식)

꽃잎/꽃받침 4개 수치로 품종(0·1·2)을 맞히는 **분류** 문제입니다.

## 작업
- \`model.mjs\`의 모델 구조·하이퍼파라미터를 고쳐 정확도를 끌어올리세요.
- \`node train.mjs\`로 train 정확도를 확인하며 반복합니다(AI에게 도움을 요청하세요).

## 채점
- '성능 점수' 탭의 **평가 실행**(또는 제출)이 숨겨진 test셋으로 **정확도**를 잽니다.
- \`data.mjs\`·\`eval.mjs\`·\`data/train.csv\`·\`package.json\`은 잠겨 있습니다(채점 공정성).
`,

  // CSV 로더(잠금) — train/test에 동일하게 쓰여 전처리를 일관되게 유지한다.
  'data.mjs': `import { readFileSync } from 'node:fs';

// CSV 로더(잠금) — 헤더 1줄 + 마지막 컬럼을 라벨(클래스 인덱스)로, 나머지를 피처로 읽는다.
// 같은 형식의 train/test에 똑같이 쓰여 전처리가 일관되게 유지된다.
export function loadCsv(path) {
  const text = readFileSync(path, 'utf8').trim();
  const [headerLine, ...lines] = text.split('\\n');
  const header = headerLine.split(',');
  const rows = lines.filter(Boolean).map((line) => line.split(',').map(Number));
  const features = rows.map((r) => r.slice(0, -1));
  const labels = rows.map((r) => r[r.length - 1]);
  return { header, features, labels };
}
`,

  // ✏️ 학생 작업 영역 — 모델 구조·하이퍼파라미터.
  'model.mjs': `import * as tf from '@tensorflow/tfjs';

// ✏️ 학생 작업 영역 — 분류 모델 구조와 하이퍼파라미터를 자유롭게 바꾸세요.
// eval(채점)은 이 buildModel을 고정 seed로 호출해 새로 학습한 뒤 숨겨진 test셋으로
// 정확도를 잰다. 따라서 "외운 정답"이 아니라 모델 설계 자체가 점수를 만든다.

// inputDim: 피처 개수, numClasses: 클래스 개수, seed: 가중치 초기화 고정용 시드.
export function buildModel(inputDim, numClasses, seed) {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
      inputShape: [inputDim],
      kernelInitializer: tf.initializers.glorotUniform({ seed }),
    }),
  );
  model.add(
    tf.layers.dense({
      units: numClasses,
      activation: 'softmax',
      kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 1 }),
    }),
  );
  model.compile({
    optimizer: tf.train.adam(0.05),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

// 학습 하이퍼파라미터 — epochs/batchSize를 조정해 성능을 끌어올리세요.
export const TRAIN_CONFIG = { epochs: 80, batchSize: 16 };
`,

  // ✏️ 학생 실험용 — train.csv로 학습해 train 성능을 빠르게 확인한다.
  'train.mjs': `import * as tf from '@tensorflow/tfjs';
import { loadCsv } from './data.mjs';
import { buildModel, TRAIN_CONFIG } from './model.mjs';

// 학생 실험용 — train.csv로 학습하고 train 정확도를 출력한다. AI와 함께 model.mjs를
// 고쳐 가며 'node train.mjs'로 빠르게 반복하세요. 실제 채점은 숨겨진 test셋으로 합니다.

const SEED = Number(process.env.DESPY_SEED || 42);
const { features, labels } = loadCsv('data/train.csv');
const numClasses = new Set(labels).size;

const xs = tf.tensor2d(features);
const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses);

const model = buildModel(features[0].length, numClasses, SEED);
console.log('학습 시작 — 피처 ' + features[0].length + '개, 클래스 ' + numClasses + '개, 표본 ' + labels.length + '개');
await model.fit(xs, ys, { ...TRAIN_CONFIG, shuffle: false, verbose: 0 });

const predIdx = model.predict(xs).argMax(1);
const acc = (await predIdx.equal(tf.tensor1d(labels, 'int32')).mean().data())[0];
console.log('train 정확도: ' + (acc * 100).toFixed(1) + '%');
console.log('제출하면 숨겨진 test셋으로 채점됩니다.');
`,

  // 채점 하네스(잠금) — 고정 seed로 새로 학습 후 숨겨진 test셋 점수를 센티넬로 출력한다.
  'eval.mjs': `import * as tf from '@tensorflow/tfjs';
import { loadCsv } from './data.mjs';
import { buildModel, TRAIN_CONFIG } from './model.mjs';

// 채점 하네스(잠금) — 학생 model.mjs를 고정 seed로 새로 학습한 뒤, 숨겨진 test셋
// (data/test.csv, 채점 시점에만 주입)으로 정확도를 재고 점수 센티넬을 출력한다.
// shuffle:false + 고정 seed로 동일 코드의 점수 변동을 줄인다(완벽한 결정성은 아님).

const SEED = Number(process.env.DESPY_SEED || 42);

const train = loadCsv('data/train.csv');
const test = loadCsv('data/test.csv');
const numClasses = new Set(train.labels).size;

const xs = tf.tensor2d(train.features);
const ys = tf.oneHot(tf.tensor1d(train.labels, 'int32'), numClasses);

const model = buildModel(train.features[0].length, numClasses, SEED);
await model.fit(xs, ys, { ...TRAIN_CONFIG, shuffle: false, verbose: 0 });

const testX = tf.tensor2d(test.features);
const predIdx = Array.from(await model.predict(testX).argMax(1).data());
let correct = 0;
test.labels.forEach((label, i) => {
  if (predIdx[i] === label) correct++;
});
const accuracy = correct / test.labels.length;

process.stdout.write(
  '__DESPY_SCORE__' +
    JSON.stringify({ metric: 'accuracy', value: accuracy }) +
    '__DESPY_SCORE_END__\\n',
);
`,

  // 학생 노출 train 데이터(잠금 — 채점 train셋을 고정해 공정성 유지).
  'data/train.csv': `sepal_len,sepal_wid,petal_len,petal_wid,species
5.8,2.99,4.13,0.71,1
6.1,2.88,4.43,1.49,1
4.84,3.77,1.47,0,0
5.06,3.6,1.36,0.24,0
5.92,3.1,4.39,1.32,1
6.73,3.37,6.03,2.66,2
6.54,2.96,5.59,1.99,2
6.59,3.01,4.29,1.49,1
5.7,3.17,4.53,1.35,1
6.17,2.88,4.46,0.6,1
5.72,2.62,4.51,1.59,1
6.86,2.99,5.15,2.55,2
5.4,2.71,4.11,1.69,1
6.62,3.05,5.84,1.82,2
6.89,2.64,5.89,1.61,2
6.44,2.94,5.47,1.84,2
6.22,3.14,4.22,1.44,1
6.26,2.36,4.6,1.41,1
5.87,2.81,4.58,1.3,1
5.08,3.17,1.62,0.08,0
5.51,3.52,1.39,0.36,0
5.04,3.79,1.18,0.14,0
6.43,2.68,6,2.2,2
6.51,2.96,5.83,1.56,2
5.18,3.91,1.85,0.2,0
4.94,2.98,1.46,0.21,0
6.33,2.82,4.64,0.98,1
5.31,3.27,2.14,0.01,0
4.67,3.76,1.31,0.38,0
6.48,3.2,5.34,1.79,2
6.75,2.8,5.97,1.87,2
5.18,3.91,1.74,1.03,0
6.97,2.72,6.15,1.99,2
5.03,3.3,1.38,0.36,0
5.11,3.66,1.65,0.4,0
6.46,2.79,5.87,2.36,2
5.76,3.14,4.15,1.49,1
4.7,3.46,1.58,0.08,0
5.24,2.86,4.38,1.36,1
5.99,3.35,5.7,2.39,2
4.88,3.22,1.84,-0.04,0
6.48,2.91,6.03,1.9,2
4.8,3.5,1.65,0.07,0
5.19,3.91,1.38,0.57,0
5.7,2.63,4.22,1.58,1
6.7,3.72,5.91,1.86,2
6.75,3.2,5.78,1.87,2
6.91,2.97,5.53,2.04,2
6.41,2.65,5.63,2.2,2
5.74,3.26,2,-0.08,0
6.45,3.02,5.78,1.98,2
5.5,3.79,1.2,-0.25,0
6.38,3.19,6.13,2.1,2
5.01,3.54,1.4,-0.09,0
6.29,2.93,4.25,1.42,1
5.71,2.54,4.47,1.29,1
4.95,3.26,1.48,0.21,0
6.01,2.68,4.5,1.17,1
5.02,3.24,1.15,-0.34,0
5.68,2.54,4.38,0.69,1
6.07,2.35,4.85,1.58,1
6.91,2.88,5.82,2,2
6.07,2.84,4.09,1.4,1
6.32,2.68,3.98,0.83,1
5.2,3.51,1.47,0.26,0
6.46,3.14,6.03,2.33,2
5.18,3.4,1.19,0.53,0
6.39,3.07,5.34,1.89,2
5.79,3.02,4.04,1.76,1
6.07,3.38,4.24,1.65,1
5.72,2.92,4.69,1.4,1
6.28,3.14,5.2,2.17,2
6.21,3.24,5.79,2.45,2
6.71,3.3,5.13,2.48,2
6.77,3.1,5.94,2.08,2
5.29,3.37,1.66,0.07,0
6.69,2.9,6.01,2,2
6.61,2.76,6.02,2.12,2
6.14,3.27,4.41,1.23,1
6.75,2.89,5.56,2.05,2
6.23,2.08,4.11,1.59,1
5.03,3.53,1.47,0.15,0
6.2,2.64,5.61,2.15,2
5.16,3.47,1.5,0.33,0
6.4,3.37,5.83,2.27,2
5.86,3.35,4.18,1.1,1
5.53,3.04,4.18,1.39,1
5.94,2.95,4.29,1.23,1
4.74,2.81,1.66,0.15,0
4.88,3.52,1.24,-0.06,0
5.93,2.79,4.6,1.33,1
4.97,3.24,1.42,0.38,0
5.04,3.19,1.51,0.44,0
4.96,3.27,1.17,-0.1,0
4.9,2.88,2.09,0.2,0
6.43,2.99,5.96,1.91,2
6.47,2.78,5.57,2.05,2
5.61,3.57,1.68,0.41,0
6.58,2.76,5.92,1.78,2
4.92,4.12,1.99,-0.03,0
5.72,2.57,4.63,1.92,1
6.03,3.12,4.1,1.74,1
6.5,2.95,5.81,2.13,2
4.84,3.55,1.59,-0.46,0
6.15,2.69,4.43,1.36,1
5.75,2.78,4.49,1.82,1
5.83,2.74,4.36,1.67,1
6.5,3.29,5.49,2.35,2
5.19,3.04,1.63,-0.21,0
4.88,3.58,1.67,0.39,0
4.9,4.12,1.01,0.44,0
6.66,2.41,5.89,2.15,2
5.36,3.24,2.17,-0.06,0
6.45,3.3,4.64,1.84,1
6.06,2.43,4.11,1.34,1
6.78,3.58,5.44,1.94,2
5.27,3.6,1.61,0.53,0
6.62,2.91,5.76,1.62,2
5.7,3,4.56,1.97,1
6.28,2.47,4.33,1.38,1
`,
};

export const ML_CLASSIFICATION_TEST_FILES: ProjectFiles = {
  // 숨긴 test 데이터 — 학생 파일트리에 노출되지 않고 채점(평가) 시점에만 컨테이너에 주입된다.
  'data/test.csv': `sepal_len,sepal_wid,petal_len,petal_wid,species
4.54,3.25,1.46,0.13,0
4.6,2.95,1.78,-0.38,0
5.92,3.2,4.52,1.37,1
6.62,3.53,6.09,2.14,2
7.23,3.23,5.58,1.73,2
5.6,3.9,1.68,0.28,0
6.13,3.04,5.82,2.16,2
5.77,2.86,4.49,1.16,1
6.92,3.06,5.71,1.8,2
5.93,2.98,4.27,1.62,1
5.21,3.47,1.61,0.23,0
5.02,3.59,1.55,0.55,0
6.91,3.05,5.58,1.69,2
5.58,3.64,1.93,0.08,0
6.86,3.17,5.62,2.12,2
6.73,2.42,5.46,2.35,2
6.09,2.37,4.66,1.22,1
6.14,2.8,4.15,1.25,1
5.8,3,4.45,1.39,1
6.46,2.07,4.61,1.28,1
6.62,3.03,4.43,1.5,1
6.9,2.74,5.59,1.87,2
5.1,3.74,1.44,0.56,0
6.44,2.84,6.24,2.37,2
5.12,3.7,1.33,0.58,0
4.83,3.1,1.55,0.06,0
4.99,3.22,1.55,0.03,0
5.03,3.14,1.57,-0.02,0
6.18,2.72,4.02,1.44,1
6.55,3.04,5.94,2.01,2
6.24,2.63,4.22,1.5,1
6.07,3.24,4.66,1.5,1
6.05,2.11,4.41,1.08,1
4.99,3.38,1.99,0.34,0
6.77,2.66,5.55,1.92,2
6.27,3.17,5.83,2.15,2
`,
};

export const ML_REGRESSION_TEMPLATE: ProjectFiles = {
  'package.json': JSON.stringify(
    {
      name: 'despy-ml-regression',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        train: 'node train.mjs',
        eval: 'node eval.mjs',
      },
      dependencies: {
        '@tensorflow/tfjs': '^4.22.0',
      },
    },
    null,
    2,
  ),

  'README.md': `# 회귀 챌린지 (주택 가격식)

면적/방수/연식 3개 수치로 연속값(가격)을 예측하는 **회귀** 문제입니다.

## 작업
- \`model.mjs\`의 모델 구조·하이퍼파라미터를 고쳐 RMSE(낮을수록 좋음)를 줄이세요.
- \`node train.mjs\`로 train RMSE를 확인하며 반복합니다(AI에게 도움을 요청하세요).
- 피처 표준화는 \`data.mjs\`(잠금)가 처리합니다.

## 채점
- '성능 점수' 탭의 **평가 실행**(또는 제출)이 숨겨진 test셋으로 **RMSE**를 잽니다.
- \`data.mjs\`·\`eval.mjs\`·\`data/train.csv\`·\`package.json\`은 잠겨 있습니다(채점 공정성).
`,

  // CSV 로더(잠금) — train/test에 동일하게 쓰여 전처리를 일관되게 유지한다.
  'data.mjs': `import { readFileSync } from 'node:fs';

// CSV 로더(잠금) — 헤더 1줄 + 마지막 컬럼을 타깃(연속값)으로, 나머지를 피처로 읽는다.
export function loadCsv(path) {
  const text = readFileSync(path, 'utf8').trim();
  const [headerLine, ...lines] = text.split('\\n');
  const header = headerLine.split(',');
  const rows = lines.filter(Boolean).map((line) => line.split(',').map(Number));
  const features = rows.map((r) => r.slice(0, -1));
  const targets = rows.map((r) => r[r.length - 1]);
  return { header, features, targets };
}

// 표준화기(잠금) — train 피처의 평균/표준편차로 (x-μ)/σ 정규화 함수를 만든다.
// 피처 스케일 차이가 커 학습이 불안정해지는 것을 막는다. train으로 만든 같은 함수를
// train·test에 동일 적용해야 전처리가 일관된다(eval/train이 함께 사용).
export function makeStandardizer(features) {
  const nFeat = features[0].length;
  const means = [];
  const sds = [];
  for (let c = 0; c < nFeat; c++) {
    const vals = features.map((r) => r[c]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    means.push(mean);
    sds.push(Math.sqrt(variance) || 1);
  }
  return (rows) => rows.map((r) => r.map((v, c) => (v - means[c]) / sds[c]));
}
`,

  // ✏️ 학생 작업 영역 — 모델 구조·하이퍼파라미터.
  'model.mjs': `import * as tf from '@tensorflow/tfjs';

// ✏️ 학생 작업 영역 — 회귀 모델 구조와 하이퍼파라미터를 자유롭게 바꾸세요.
// eval(채점)은 표준화된 피처로 이 모델을 고정 seed로 새로 학습한 뒤, 숨겨진 test셋의
// RMSE(낮을수록 좋음)를 잰다. 출력은 연속값 1개이므로 마지막 층은 활성함수 없이 둡니다.

// inputDim: 피처 개수, seed: 가중치 초기화 고정용 시드.
export function buildModel(inputDim, seed) {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
      inputShape: [inputDim],
      kernelInitializer: tf.initializers.glorotUniform({ seed }),
    }),
  );
  model.add(
    tf.layers.dense({
      units: 1,
      kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 1 }),
    }),
  );
  model.compile({ optimizer: tf.train.adam(0.05), loss: 'meanSquaredError' });
  return model;
}

// 학습 하이퍼파라미터 — epochs/batchSize를 조정해 RMSE를 낮추세요.
export const TRAIN_CONFIG = { epochs: 150, batchSize: 16 };
`,

  // ✏️ 학생 실험용 — train.csv로 학습해 train 성능을 빠르게 확인한다.
  'train.mjs': `import * as tf from '@tensorflow/tfjs';
import { loadCsv, makeStandardizer } from './data.mjs';
import { buildModel, TRAIN_CONFIG } from './model.mjs';

// 학생 실험용 — train.csv로 학습하고 train RMSE를 출력한다. AI와 함께 model.mjs를
// 고쳐 가며 'node train.mjs'로 반복하세요. 실제 채점은 숨겨진 test셋으로 합니다.

const SEED = Number(process.env.DESPY_SEED || 42);
const { features, targets } = loadCsv('data/train.csv');
const standardize = makeStandardizer(features);

const xs = tf.tensor2d(standardize(features));
const ys = tf.tensor2d(targets.map((t) => [t]));

const model = buildModel(features[0].length, SEED);
console.log('학습 시작 — 피처 ' + features[0].length + '개, 표본 ' + targets.length + '개');
await model.fit(xs, ys, { ...TRAIN_CONFIG, shuffle: false, verbose: 0 });

const preds = Array.from(await model.predict(xs).data());
let se = 0;
targets.forEach((t, i) => {
  se += (preds[i] - t) ** 2;
});
console.log('train RMSE: ' + Math.sqrt(se / targets.length).toFixed(3));
console.log('제출하면 숨겨진 test셋으로 채점됩니다.');
`,

  // 채점 하네스(잠금) — 고정 seed로 새로 학습 후 숨겨진 test셋 점수를 센티넬로 출력한다.
  'eval.mjs': `import * as tf from '@tensorflow/tfjs';
import { loadCsv, makeStandardizer } from './data.mjs';
import { buildModel, TRAIN_CONFIG } from './model.mjs';

// 채점 하네스(잠금) — 학생 model.mjs를 고정 seed로 새로 학습한 뒤, 숨겨진 test셋
// (data/test.csv, 채점 시점에만 주입)의 RMSE를 재고 점수 센티넬을 출력한다.
// 표준화기는 train으로 만들어 train·test에 동일 적용한다(전처리 일관성).

const SEED = Number(process.env.DESPY_SEED || 42);

const train = loadCsv('data/train.csv');
const test = loadCsv('data/test.csv');
const standardize = makeStandardizer(train.features);

const xs = tf.tensor2d(standardize(train.features));
const ys = tf.tensor2d(train.targets.map((t) => [t]));

const model = buildModel(train.features[0].length, SEED);
await model.fit(xs, ys, { ...TRAIN_CONFIG, shuffle: false, verbose: 0 });

const testX = tf.tensor2d(standardize(test.features));
const preds = Array.from(await model.predict(testX).data());
let se = 0;
test.targets.forEach((t, i) => {
  se += (preds[i] - t) ** 2;
});
const rmse = Math.sqrt(se / test.targets.length);

process.stdout.write(
  '__DESPY_SCORE__' +
    JSON.stringify({ metric: 'rmse', value: rmse }) +
    '__DESPY_SCORE_END__\\n',
);
`,

  // 학생 노출 train 데이터(잠금 — 채점 train셋을 고정해 공정성 유지).
  'data/train.csv': `area,rooms,age,price
2.56,4.56,35.55,57.15
6.92,4.26,22.04,145.09
3.72,1.04,9.66,68.76
7.42,3.48,46.85,114.95
3.09,2.25,26.95,50.08
6.19,4,25.24,120.45
4.96,4.52,41.78,96
2.12,3.32,25.56,45.08
3.13,4.85,18.86,95.22
4.18,4.88,42.36,78.12
2.93,4.51,8.62,101.91
3.31,1.58,26.77,50.04
3.31,1.81,35.95,36.67
5.72,2.16,40.95,79.28
2.79,4.95,8.94,98.29
3.15,4.69,39.96,62.69
7.47,4.27,15.23,165.24
4.75,1.94,15.75,87.24
5.7,1.2,17.22,90.53
5.04,4.39,12.19,127.15
4.39,1.32,42.53,38.9
4.96,2.78,43.42,75.41
6.52,4.52,9,161.67
4.46,1.16,47.15,41.81
3.96,3.02,35.8,69.9
7.46,4.97,33.96,151.21
5.4,1.06,48.29,55.14
5.77,1.82,8.76,111.84
2.2,2.51,46.2,18.32
5.73,4.02,8.29,141.42
2.31,2.18,16.34,47.06
2.26,4.76,31.99,63.37
5.7,3.11,8.44,131.34
7.73,4.76,23.43,166.22
4.06,2.09,29.18,59.47
3.1,2.26,11.94,70.21
3.37,4.63,42.17,63.44
3.63,3.14,37.82,55.49
4.75,3.39,36.65,74.31
2.94,4.23,21.44,80.49
4.99,1.95,25.41,80.33
5.51,3.23,39.7,86.74
7.41,2.8,48.35,109.35
5.73,1.68,11.43,112.65
7.59,2.81,45.74,109.79
7.85,3.77,33.04,140.6
5.09,4.83,31.6,115.38
7.08,1.31,48.11,91.96
6.35,3.39,33.67,110.99
5.04,4.76,23.33,124.37
3.61,3.73,38.51,64.24
6.3,2.32,49.42,78.49
5.26,1.98,10.71,104.53
7.27,2.1,37.98,109.62
2.53,2.11,44.47,16.16
2.32,1.09,28.89,15.34
3.45,3.25,16.96,80.45
6.77,4.08,42.4,116.29
6.77,2.97,27.17,126.07
6.57,2.56,16.09,135.93
4.16,3.63,44.13,68.19
3.31,2.81,17.74,74.52
2.1,2.22,21.48,42.38
6.63,2.11,40.67,101.37
7,4.26,36.4,131.18
2.1,1.41,5.53,51.34
2.51,4.79,10.05,97.07
6.97,3.66,10.68,162.28
2.44,4.26,48.13,34.24
6.74,2.35,22.43,119.8
7.4,4.5,40.82,137.37
5.15,2.99,8.23,114.31
5.35,4.07,48.24,90.68
5.28,2.19,22.39,92.82
2.26,3.26,44.31,26.6
2.16,1.86,37.97,14.73
5.46,1.61,42.93,70.05
4.19,3.89,45.43,64.78
3.35,4.89,7.99,113.6
7.95,4.36,20.21,172.58
3.09,3.32,46.76,39.51
2.04,4.86,25.21,65.09
6.42,3.88,40.34,118.25
3.57,1.2,48.69,24.3
5.79,1.55,11.2,114.81
5.18,2.81,40.01,76.33
3.79,4.82,44.16,76.18
7.91,4.87,32.19,160.24
5.24,3.04,13.73,114.28
7.69,3.56,10.57,172.54
4.28,2.75,49.99,52.04
4.16,1.26,45,34.55
6.92,4.55,12.84,161.59
2.84,2.75,16.14,63.17
4.62,3.68,12.96,107.33
5.47,1.18,36.43,69.9
3.85,2.01,30.05,58.54
2.7,1.24,44.78,3.09
5.08,3.31,31.96,90.38
2.29,3.98,37.4,45
2.31,3.48,33.94,44.96
4.9,2.32,33.07,75.07
5.15,2.46,42.79,73.83
5.65,2.28,30.42,91.11
7.67,1.07,7.22,144.31
3.06,4.9,44.53,57.63
7.37,2.43,32.15,128.14
7.69,3.05,23.15,150.77
6.92,2.14,10.37,139.79
7.5,1.44,29.02,122.63
2.94,2.42,49.24,18.79
5.41,2.18,10.71,111.55
7.15,2.66,16.34,141.05
5.43,3.86,11.6,132.34
7.47,2.88,31.15,132.43
6.22,2.57,48.2,84.17
7.04,4.07,34.01,144.54
5.92,4.95,11.96,147.76
7.32,1.68,46.49,98.15
3.18,1.22,27.16,37.25
`,
};

export const ML_REGRESSION_TEST_FILES: ProjectFiles = {
  // 숨긴 test 데이터 — 학생 파일트리에 노출되지 않고 채점(평가) 시점에만 컨테이너에 주입된다.
  'data/test.csv': `area,rooms,age,price
6.47,1.5,40.6,80.17
7.06,2.47,11.82,129.91
4.15,2.63,26.4,69.27
6.15,2.64,33.83,102.95
4.16,1.44,33.29,54.32
5.81,1.31,23.08,83.15
2.61,1.44,37.79,20.2
6.39,2.07,6.25,131.36
6.84,3.91,8.83,159.75
7.36,2.84,16.26,141.36
2.71,4.55,6.98,95.4
2.5,2.34,17.3,48.94
4.01,4.32,25.67,92.85
7.46,4.66,46,126.59
2.05,2.57,21.86,36.07
5.02,4.87,19.5,127.95
5.61,1.24,36.21,67.5
3.75,3.04,14.08,82.22
5.48,2.97,47.79,74.17
2.39,4.54,11.73,79.56
3.05,1.7,20.35,49.39
6.41,3.03,40.99,109.06
5.21,3.01,41.26,79.56
4.56,3.39,26.1,93.89
4.1,1,46.87,27.55
5.93,1.61,48.32,74.72
2.3,4.29,22.04,64.41
3.58,3.1,10.38,90.42
3.26,1.56,27.33,45.52
3.59,3.83,7.2,101.19
5.31,1.09,10.12,90.38
4.48,1.93,29.63,67.63
6.66,4.81,26.27,145.91
2.39,2.79,41.06,34.18
5.7,4.79,44.07,104.82
2.12,1.47,17.84,32.7
`,
};

export const ML_CLASSIFICATION_LOCKED_PATHS: readonly string[] = [
  'package.json',
  'README.md',
  'data.mjs',
  'eval.mjs',
  'data/train.csv',
];

export const ML_REGRESSION_LOCKED_PATHS: readonly string[] = [
  'package.json',
  'README.md',
  'data.mjs',
  'eval.mjs',
  'data/train.csv',
];
