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
