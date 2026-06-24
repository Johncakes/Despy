# despy

> 에이전틱 코딩 평가 시스템 — 학생이 **통제된 AI 에이전트**를 활용해 알고리즘 문제를 푸는 과정을 평가하는 웹 서비스.

교수가 문제·테스트케이스와 AI 정책(모델 고정·질문 횟수·토큰·시스템 프롬프트)을 통제하고,
학생은 제한된 자원 안에서 AI를 부려 코드를 작성·제출한다. 제출 코드는 Judge0로 자동 채점된다.

> 현재 저장소는 **초기 세팅(스타터)** 상태입니다. 도메인 기능은 `src/features/`에 점진적으로 추가합니다.

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # MONGODB_URI 등 설정
npm run dev                  # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint + 레이어 규칙 검사 |
| `npm run typecheck` | 타입 체크 (`tsc --noEmit`) |
| `npm run test` | vitest 실행 |

> `git commit` 시 husky + lint-staged가 변경된 `.ts/.tsx`에 대해 `tsc --noEmit` + `eslint --fix`를 자동 실행합니다.

## 기술 스택

Next.js (App Router) · React 19 · TypeScript · styled-components · Zustand · TanStack Query · MongoDB

(예정) Monaco Editor · Judge0 (Docker) · LLM API

## 아키텍처 / 컨벤션

- AI 에이전트 작업 가이드: [`CLAUDE.md`](./CLAUDE.md)
- 코딩 컨벤션 상세: [`docs/conventions.md`](./docs/conventions.md)

핵심 원칙: **feature-based 구조 + 단방향 레이어 의존**(`features → shared`만 허용).
이 규칙은 `eslint.config.mjs`의 `import/no-restricted-paths`로 빌드에서 강제됩니다.
