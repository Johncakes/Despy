/**
 * eslint.config.mjs — ESLint flat config (레이어 규칙 강제 포함)
 *
 * Next.js 16 + ESLint 9 flat config. feature-based 아키텍처의 단방향 의존
 * 규칙(shared → features 금지 등)을 `import/no-restricted-paths`로 빌드에서
 * 강제한다. 이 규칙이 레이어 구조를 지키는 유일한 자동화 수단이다.
 *
 * 사용처: `npm run lint`, lint-staged(pre-commit), CI
 */
import next from 'eslint-config-next';
import importPlugin from 'eslint-plugin-import';

const eslintConfig = [
  ...next,
  {
    plugins: { import: importPlugin },
    rules: {
      // ── 레이어 규칙: 단방향 의존성 강제 ───────────────────────────────
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/shared',
              from: './src/features',
              message:
                '레이어 위반: shared는 features를 import할 수 없습니다 (props/DI로 주입). 단, shared/reader는 예외입니다.',
            },
            {
              target: './src/shared/core',
              from: './src/shared/components',
              message: '레이어 위반: core는 components를 import할 수 없습니다.',
            },
            {
              target: './src/shared/lib',
              from: './src/shared/components',
              message: '레이어 위반: lib은 components를 import할 수 없습니다.',
            },
            {
              target: './src/shared/core',
              from: './src/shared/lib',
              message:
                '레이어 위반: core는 lib을 import할 수 없습니다 (데이터 타입은 core/types에 두세요).',
            },
          ],
        },
      ],
      // ── 컨벤션 강제 ───────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // shared/reader는 앱 진입점 오케스트레이터 — features 의존 허용(유일한 예외)
    files: ['src/shared/reader/**/*.{ts,tsx}'],
    rules: {
      'import/no-restricted-paths': 'off',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
