# despy

> 에이전틱 코딩 평가 시스템 — 학생이 **통제된 AI 에이전트**를 활용해 알고리즘 문제를 푸는 과정을 평가하는 웹 서비스.

교수가 문제·테스트케이스와 AI 정책(모델 고정·질문 횟수·토큰·시스템 프롬프트)을 통제하고,
학생은 제한된 자원 안에서 AI를 부려 코드를 작성·제출한다. 제출 코드는 Judge0로 자동 채점된다.

> **상태**: MVP 구현 완료 — 교수 출제(`/author`) · 학생 풀이(`/solve/[id]`) · AI/채점 프록시.
> 동작 원리는 [`docs/architecture.md`](./docs/architecture.md) 참조.

## 기능 (MVP)

- **교수** (`/author`): 문제·입출력·제한·허용 언어·테스트 케이스(공개/비공개)·AI 정책 출제
- **학생** (`/solve/[id]`): 문제 지문 · Monaco 에디터 · 제한된 AI 도우미 · 예제 실행/제출 · 채점 결과
- **AI 계층** (`/api/agent`): Gemini 프록시 — 키 은닉 + 시스템 프롬프트 주입 + 토큰 usage
- **채점 계층** (`/api/judge`): Judge0 프록시 — `JUDGE0_URL` 없으면 **모의 채점**으로 즉시 동작

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # GEMINI_API_KEY 입력 (https://aistudio.google.com/apikey)
npm run dev                  # http://localhost:3000  (채점은 키 없이도 모의로 동작)
```

| 환경 변수 | 필수 | 용도 |
|---|---|---|
| `GEMINI_API_KEY` | AI 사용 시 | Gemini 키(서버 전용, 클라이언트 비노출) |
| `JUDGE0_URL` | 선택 | 없으면 모의 채점 · 있으면 실제 Judge0 ([docs/judge0.md](./docs/judge0.md)) |

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

Next.js (App Router) · React 19 · TypeScript · styled-components · Zustand · TanStack Query
· Monaco Editor · Vercel AI SDK (`@ai-sdk/google`, Gemini) · react-markdown · Judge0

> **방향**: 백엔드 최소화(키 은닉·프록시용 Route Handler 2개) · MongoDB 지양.
> 현재 데이터는 localStorage에 저장하며 `shared/lib/db/mongodb.ts`·`MONGODB_URI`는 미사용(제거 대상).

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | **MVP 동작 원리** — 요청/응답 계약, 데이터 흐름, 상태 관리, 한계 |
| [`CLAUDE.md`](./CLAUDE.md) | AI 에이전트 작업 가이드 (레이어 규칙·컨벤션 요약) |
| [`docs/conventions.md`](./docs/conventions.md) | 코딩 컨벤션 상세 |
| [`docs/judge0.md`](./docs/judge0.md) | Judge0 로컬 채점 셋업 |

핵심 원칙: **feature-based 구조 + 단방향 레이어 의존**(`features → shared`만 허용).
이 규칙은 `eslint.config.mjs`의 `import/no-restricted-paths`로 빌드에서 강제됩니다.
