/**
 * webcontainerTemplates.ts — WebContainer 부팅 검증용 샘플 프로젝트 템플릿
 *
 * P0 PoC에서 WebContainer가 실제로 부팅→mount→npm install→npm run dev→미리보기까지
 * 도는지 확인하기 위한 최소 Vite + React 스타터다. install 시간을 줄이려고
 * 의존성을 vite/react/react-dom/plugin-react로만 한정하고, COEP(require-corp)에
 * 걸리지 않도록 **외부 CDN·웹폰트 없이** 시스템 폰트·로컬 스타일만 쓴다.
 *
 * 본 출제용 프리셋 템플릿은 후속 단계(P4 출제 도구)에서 별도로 확장한다.
 *
 * 사용처: features/solve/WorkspacePlaygroundView (P0 PoC)
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
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^5.4.10',
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
