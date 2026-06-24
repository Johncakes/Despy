# despy — AI Agent Guide

> 에이전틱 코딩 평가 시스템 — 학생이 통제된 AI 에이전트를 활용해 알고리즘 문제를 푸는 과정을 평가하는 웹 서비스.
> 이 문서는 AI 에이전트가 프로젝트 작업 시 **첫 번째로 읽는 지도**입니다.

---

## 프로젝트 개요

AI 코딩 도구가 보편화된 환경에서, "AI를 효과적으로 부려 문제를 푸는 능력"을 정량 평가한다.
교수는 문제·테스트케이스를 출제하고 AI 정책(모델 고정·질문 횟수·토큰·시스템 프롬프트)을 통제하며,
학생은 제한된 자원 안에서 AI 에이전트를 활용해 코드를 작성·제출하고 AI 정성 채점을 받는다.

핵심 도메인 (MVP 구현됨):
- **교수** (`features/author`): 문제 출제 + AI 정책 설정 (모델·질문/토큰 한도·시스템 프롬프트)
- **학생** (`features/solve`): 문제 지문 + 제한된 AI 대화(주역) + Monaco 에디터 + 제출·채점 결과
  - AI 답변의 코드 펜스를 에디터로 **실시간 미러링**(직접 편집 토글·작성 중 read-only·되돌리기)
- **채점** (`app/api/grade/algorithm`): AI 정성 채점 — 코드를 실행하지 않고 테스트케이스 기준으로
  정답성을 판정한다(Judge0 실행 채점 제거 — P5, 2026-06-24). 무결성 한계(실행 아닌 추론)는 UI에 명시.
- **ML 챌린지** (`kind: 'ml'` 워크스페이스): 브라우저 WebContainer에서 pure @tensorflow/tfjs로
  모델을 작성(`model.mjs`)·학습하고, 제출 시 숨긴 test셋을 주입해 성능 지표(분류 정확도·회귀 RMSE)를
  **객관 채점**(컨테이너 실행 결과) + AI 활용을 **정성 채점**(루브릭)한다. (`docs/spec-ml-challenge.md`)
- **AI 계층** (`app/api/agent`): Gemini 프록시 — 키 은닉 + 시스템 프롬프트 주입 + 출력 토큰 한도
- **인증/권한** (`features/auth`·`features/admin`·`app/api/auth`·`app/api/admin`): 이메일/비밀번호 +
  JWT 세션 로그인, 역할(학생/교수/관리자) 기반 접근 통제(RBAC). 사용자는 MongoDB에 영속.
  자가 가입은 기본 `student`이며 관리자가 교수로 승격. (실서비스 전환 — `docs/spec-production-v1.md`)

> 상세 명세는 별도 기획 문서 참조.
>
> **MVP 범위/한계** (확정):
> - 인증·교수/학생 권한 분리·다중 사용자 동시성은 **미구현**(범위 밖).
> - 문제·AI정책·풀이 세션은 **localStorage**(Zustand persist)에 저장 — 별도 DB 없음.
>   따라서 시스템 프롬프트 비밀성·질문/토큰 한도는 **UX 수준**이며 변조 불가능한
>   보안 수준은 아니다(무서버세션 한계). 백엔드는 키 은닉·프록시 용도로만 최소 사용.

### 🧭 아키텍처 방향 (갱신: 2026-06-24 — 백엔드 최소화 원칙 **해제**)

- **백엔드는 가치가 있는 곳에 둔다.** 기존 "백엔드 최소화" 원칙은 **해제**되었다(2026-06-24).
  채점 무결성·민감정보(루브릭·테스트파일·시스템 프롬프트) 은닉처럼 **서버가 더 적합한 책임**은
  Next.js Route Handler(또는 별도 서비스)로 구현한다. 단 불필요한 복잡도는 여전히 피하고,
  단순해도 되는 것은 클라이언트에 둔다.
- **DB는 필요 시 도입 가능.** 기존 "MongoDB 지양"은 완화되어, 영속이 필요하면 저장소를 도입한다.
  구체적 선택(IndexedDB·Postgres·MongoDB 등)은 요구사항이 구체화되는 시점에 사안별로 결정한다.
  → `shared/lib/db/mongodb.ts`·`MONGODB_URI`는 **인증/사용자 영속에 사용 중**(실서비스 전환 — users 컬렉션).
- ⚠️ 새 백엔드 서비스·DB·외부 의존성을 *추가*하는 것은 영향이 크므로 도입 전 논의(Blocking)한다 —
  단 "백엔드를 두는 것 자체"는 더 이상 금지가 아니다.

---

## 빠른 시작

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (Turbopack)
npm run build        # 프로덕션 빌드
npm run typecheck    # 타입 체크 (tsc --noEmit, 빌드 없이)
npm run lint         # ESLint + 레이어 규칙 검사
npm run test         # vitest 실행
npm run seed:admin   # 최초 관리자 계정 생성 (ADMIN_SEED_* 환경변수, .env.local 로드)
# git commit 시 husky가 자동으로 tsc + lint 실행 (lint-staged)
```

- **환경 변수**: `.env.local`에 `GEMINI_API_KEY`(AI 채팅 + 채점 공용), `MONGODB_URI`(사용자 영속),
  `JWT_SECRET`(세션 서명) 필요. 최초 관리자 시드용 `ADMIN_SEED_*`. 자세히는 `.env.example`.
- **배포**: 미정 (코드 실행 채점 인프라 불필요 — 채점은 AI 정성 판정으로 일원화. WebContainer는 브라우저 내 실행)
- **기술 스택**: Next.js (App Router) · React 19 · TypeScript · styled-components · Zustand · TanStack Query
  · Monaco Editor(`@monaco-editor/react`) · Vercel AI SDK(`ai` + `@ai-sdk/google`, Gemini) · react-markdown
  · **WebContainer**(`@webcontainer/api`, 브라우저 내 Node 런타임 — 피벗 P0~)
  · **인증**: `jose`(JWT, Edge 호환) · `bcryptjs`(비밀번호 해시) · `mongodb`(사용자 영속)
  - ⚠️ WebContainer는 cross-origin isolation이 필수라 `next.config.ts`가 모든 응답에
    COOP(`same-origin`)+COEP(`require-corp`) 헤더를 주입한다. 새 외부 CDN/폰트 도입 시 CORP/CORS 점검 필수.
  - _(MongoDB는 **사용 중** — 인증/사용자(users) 영속. 다른 도메인 데이터는 아직 localStorage)_

---

## 아키텍처

### 디렉토리 구조 (feature-based)

```
src/
├── app/                          Next.js App Router (라우팅만 — 로직 없음)
│   ├── page.tsx                  홈 (역할 진입 + 과제/알고리즘 문제 목록)
│   ├── author/page.tsx           교수 출제 화면 진입점 (알고리즘 — Problem)
│   ├── author/challenge/page.tsx 교수 과제 출제 화면 진입점 (워크스페이스 — 피벗 P4)
│   ├── author/challenge/[challengeId]/submissions/page.tsx 교수 채점 대시보드 진입점 (집계 + 프롬프트별 diff 타임라인)
│   ├── solve/[problemId]/page.tsx 학생 풀이 화면 진입점 (알고리즘 — AI 채점)
│   ├── workspace/[challengeId]/page.tsx 학생 과제 풀이(워크스페이스) 진입점 (피벗 P1)
│   ├── mypage/page.tsx            마이페이지 진입점 (알고리즘 풀이 이력 + 과제 제출 이력 대시보드 — features/mypage)
│   ├── playground/page.tsx       WebContainer PoC 진입점 (P0 — spec-webcontainer.md)
│   ├── login/page.tsx · signup/page.tsx   인증 화면 진입점 (features/auth)
│   ├── admin/users/page.tsx      사용자/역할 관리 진입점 (관리자 전용 — features/admin)
│   └── api/                      백엔드 (키 은닉·AI 프록시·채점·인증)
│       ├── agent/route.ts        AI 프록시 (Gemini, 스트리밍 + 토큰 usage) — requireUser 가드
│       ├── grade/route.ts        과제 공식 채점 (AI 루브릭 정성 채점 + 가중합, 피벗 P3) — requireUser 가드
│       ├── grade/algorithm/route.ts 알고리즘 공식 채점 (AI 정성 판정 — Judge0 대체, P5) — requireUser 가드
│       ├── auth/{signup,login,logout,me}/route.ts  이메일/비번 + JWT 세션
│       └── admin/users/{route.ts,[userId]/route.ts}  사용자 목록·역할 변경 (admin)
│
├── proxy.ts                      페이지 라우트 인증/인가 게이트 (Edge, 구 middleware — Next.js 16 proxy)
│
├── features/                     도메인별 기능 모듈 (세로 슬라이스)
│   ├── author/                   교수(알고리즘): AuthorView, ProblemForm, TestCaseEditor,
│   │                             AiPolicyFields(공용), useProblemDraft
│   │                             + (피벗 P4) ChallengeAuthorView, useChallengeDraft, components/
│   │                               ChallengeForm(kind 선택 웹/ML · ML이면 프리셋(분류/회귀)·MlSpec(지표·임계값·seed·경로·evalCommand) 필드)·FileSetEditor(프리셋·잠금 토글)·RubricEditor
│   │                               + GradingDashboardView (채점 대시보드 — 집계(점수분포·루브릭평균·AI사용량) + 제출 비교표 → 행 클릭 시 중앙 모달에서 탭(루브릭·대화(학생↔AI 트랜스크립트)·프롬프트-앵커 diff 타임라인·제출코드). 채점 기준도 헤더 버튼의 모달로 분리)
│   ├── solve/                    학생(알고리즘): SolveView, ProblemPanel, CodeEditorPanel,
│   │                             GradingResultPanel (AI 채점 결과 — 케이스별 근거·종합 피드백)
│   │                             + (피벗 P1) ChallengeSolveView, ChallengeStatementPanel,
│   │                               AiChatPanel(공용 — aiPolicy 주입), useWorkspace, components/
│   │                               WorkspacePanel(탭: 미리보기[풀스택]·데이터[백엔드면 미리보기 대신 노출]·API 콘솔·API 로그·DB 상태·콘솔·브라우저·테스트 / ML 챌린지면 미리보기·테스트 대신 **성능 점수**(평가 실행→정확도/RMSE 게이지·합격 배지) 탭)·WorkspaceEditorPanel·FileTree(VSC식 중첩 트리·동적 CRUD: 생성/삭제/이름변경/이동)·FileTreeIcons(인라인 SVG 아이콘)·WorkspacePlaygroundView·ApiConsole(백엔드 라이브 콘솔 — Swagger식 엔드포인트 목록(소스에서 라우트 추론·클릭 프리필)·요청 전송·응답)·DataTablePanel(데이터 상태 테이블 뷰 — 컬렉션 조회 결과를 표로, API 콘솔의 변경 요청 시 자동 갱신·수동 새로고침·데이터 초기화(dev 서버 재시작). apiData·refreshApiData는 useWorkspace가 소유)·ApiLogList(요청/응답 실시간 로그)·DbInspector(저장소 db.json 실시간 표)
│   │                               + (피벗 P3) ChallengeGradingResultPanel(제출 채점 결과 모달)
│   ├── mypage/                   마이페이지: MyPageView (알고리즘 풀이 이력 카드 그리드 + 과제 제출 테이블 — 로컬 스토어 집계)
│   ├── auth/                     인증: LoginView, SignupView (이메일/비번 + JWT)
│   └── admin/                    사용자 관리: AdminUsersView (역할 승격 — 관리자 전용)
│
└── shared/                       공유 레이어 (4개 그룹)
    ├── core/                     데이터 & 상태
    │   ├── api/                  gradeApi.ts (과제 채점 fetch, 피벗 P3) · algorithmGradeApi.ts (알고리즘 AI 채점 fetch, P5 — judgeApi 대체) · authApi.ts (로그인/가입/로그아웃/me·관리자 사용자 fetch)
    │   ├── stores/               challengeStore.ts(피벗), workspaceStore.ts(피벗 P4 — 풀이 영속, IndexedDB), idbStorage.ts(IndexedDB StateStorage 어댑터), submissionStore.ts(피벗 — 제출 채점결과+제출코드+프롬프트(시점별 코드 스냅샷)+AI사용량+이상행위 로그(integrityLog) 보관, 대시보드 소스), problemStore.ts(알고리즘), solveSessionStore.ts (코드/언어/AI 사용량 per-problem), solveHistoryStore.ts (알고리즘 채점 결과 이력 per-problem — 마이페이지 소스)
    │   ├── queries/              gradeQueries.ts (과제 채점 mutation, 피벗 P3), algorithmGradeQueries.ts (알고리즘 AI 채점 mutation, P5 — judgeQueries 대체), authQueries.ts (useCurrentUser·login/signup/logout·관리자 사용자/역할), queryKeys.ts (auth·admin)
    │   ├── types/                index.ts (ChallengeProblem(+kind·ml)·ChallengeKind·MlSpec·MlMetric·MlEvalResult·MlGradingResult·GradingRubric·ChallengeGradingRequest(+mlScore)·ChallengeGradingResult(+ml)·ProjectFiles·AiPolicy / 알고리즘 Problem·TestCase·GradingRequest·GradingResult 계열 / 인증 UserRole·AuthUser)
    │   └── constants/            theme.ts, languages.ts(judge0Id 제거됨), aiPolicy.ts, sampleChallenges.ts(피벗), sampleProblems.ts(알고리즘),
    │                             webcontainerTemplates.ts (샘플 트리 — Vite+React 프론트 / Express 백엔드 / 풀스택(Vite+Express 단일 컨테이너, FULLSTACK_PREVIEW_PORT). 백엔드 템플릿은 db 모듈(파일 백업 db.json+인메모리, createApp(db) DI)·요청 로깅 미들웨어(stdout 센티넬→API 로그)·node --watch 자동 재시작 포함. **ML 챌린지 템플릿**(ML_CLASSIFICATION_TEMPLATE·ML_REGRESSION_TEMPLATE + ML_*_TEST_FILES 숨긴 test셋 + ML_*_LOCKED_PATHS): pure @tensorflow/tfjs(tfjs-node 불가)로 dev 서버 없이 학습·평가, 잠긴 eval.mjs가 고정 seed로 새로 학습 후 __DESPY_SCORE__ 센티넬로 점수 출력. 학생은 model.mjs·train.mjs만 편집)
    ├── lib/                      재사용 로직
    │   ├── auth/                 password.ts(bcryptjs 해시) · jwt.ts(jose 서명·검증 + SESSION_COOKIE) · session.ts(쿠키 발급/해제 · getCurrentUser·requireUser·requireRole 가드)
    │   ├── db/                   mongodb.ts (연결 싱글턴 — lazy, getClient/getDb) · users.ts (users 컬렉션 리포지토리 — passwordHash 제외 매핑)
    │   ├── grader/               grader.ts(인터페이스 — gradeRubric+gradeAlgorithm) · geminiGrader.ts(구현) · score.ts(정규화·가중합(ML은 objectiveRatioOverride로 성능 비율 대체)·알고리즘 정규화) · mlScore.ts(ML 지표 방향·합격 판정(accuracy≥/rmse≤)·표시·[0,1] 환산 — UI·채점 공용) · requestValidation.ts(요청 검증·mlScore) · index.ts(교체점)
    │   ├── webcontainer/         runtime.ts (싱글턴 부팅·mount·spawn·타임아웃 가드 · startDevServer는 previewPort로 풀스택 멀티포트 중 프론트 포트만 미리보기 확정 · sendHttpRequest는 컨테이너 안에서 백엔드로 요청 실행→API 콘솔용, 호스트 직접 fetch의 CORS/COEP 회피 · readContainerFile/watchContainerFile은 db.json을 fs.watch→DB 상태 라이브 뷰 · runScoreEval은 ML eval(evalCommand)을 일회 실행해 __DESPY_SCORE__ 센티넬 파싱→성능 점수, 타임아웃·seed env(DESPY_SEED) 주입) · fileSync.ts (편집→FS debounce 동기화) · testRunner.ts (npm test 실행·JSON 리포터 파싱→AutoTestResult)
    │   ├── utils/                logger.ts, markdownCode.ts (AI 코드블록 추출), lineDiff.ts (라인/파일트리 diff — 대시보드 코드 변경점)
    │   └── hooks/                useHasMounted.ts (hydration 가드), useProctoringMonitor.ts (시험 감독 — 탭이탈·붙여넣기·전체화면이탈 감지·IntegrityLog 제공 · docs/spec-anti-cheating.md)
    ├── components/               모든 UI 컴포넌트
    │   ├── ui/                   Button, Panel, Modal(중앙 오버레이 — ESC·배경클릭 닫기·스크롤락), Badge, Markdown, QuotaMeter, Field, PageShell
    │   └── providers/            AppProviders, ThemeProvider, QueryProvider, styled 레지스트리
    └── reader/                   앱 진입점 오케스트레이터 (features 의존 허용 — 유일한 예외, 현재 미사용)
```

### 레이어 규칙 (단방향 의존 — 이 프로젝트의 핵심)

```
features/ → shared/*            (가능)
shared/   → features/           (금지 — 레이어 위반, 단 shared/reader는 예외)
features/A → features/B         (금지 — 기능 간 직접 참조)
```

| 레이어 | 위치 | import 가능 대상 |
|---|---|---|
| features | `src/features/*` | shared/core, shared/lib, shared/components |
| shared/components | `src/shared/components/*` | shared/core, shared/lib |
| shared/lib | `src/shared/lib/*` | shared/core, 외부 라이브러리 |
| shared/core | `src/shared/core/*` | 외부 라이브러리만 (core 내부 간 참조 허용) |
| shared/reader | `src/shared/reader/*` | 앱 진입점 — features 의존 허용 (유일한 예외) |

> ⚠️ 이 규칙은 `eslint.config.mjs`의 `import/no-restricted-paths`로 **빌드에서 강제**됩니다.
> `src/shared/`의 아무 파일에서 `@/features/...`를 import하면 lint 에러가 나야 정상입니다.

**위반 패턴 (절대 금지) → 의존성 역전(DI)으로 해결:**
```tsx
// ❌ shared 컴포넌트에서 feature store import
import { useFeatureStore } from '@/features/x/xStore';

// ✅ props/render prop으로 주입
interface ListProps {
  items: Item[];
  onItemSelect?: (id: string) => void;
}
```

---

## 상태 관리 — 서버 상태 vs 클라이언트 상태 (반드시 구분)

| 상태 종류 | 도구 | 위치 |
|---|---|---|
| **서버 데이터** (fetch/cache/동기화/재요청) | **TanStack Query** | `shared/core/queries/` |
| **클라이언트·UI 상태** (모달, 설정, 세션, 선택값) | **Zustand** | `shared/core/stores/` |

**규칙**
- 서버 응답을 Zustand에 **복사 저장 금지** (Query 캐시가 단일 출처)
- 데이터 호출은 `*Api.ts`에만. 컴포넌트는 Query 훅만 사용
- Query key는 배열 팩토리로 중앙화: `queryKeys.{domain}.detail(id)` (`shared/core/queries/queryKeys.ts`)
- **연결 싱글턴**(`shared/lib/db/mongodb.ts`)으로 dev hot-reload 커넥션 누수 방지 — 인증/사용자 영속에 사용 중. 새 도메인 저장소를 추가할 땐 별도 논의한다(2026-06-24 백엔드 최소화 해제)

**현재 구현**
- 서버 데이터: 채점은 **mutation** — 과제는 `useGradeChallenge`(`gradeQueries.ts` → `/api/grade`),
  알고리즘은 `useGradeAlgorithm`(`algorithmGradeQueries.ts` → `/api/grade/algorithm`).
  인증/사용자는 `authQueries.ts` — 현재 사용자는 `useCurrentUser`(query, `queryKeys.auth.me`),
  로그인/가입/로그아웃·관리자 사용자/역할은 mutation. **현재 사용자(서버 상태)는 Query가 단일 출처**(별도 auth store 없음).
  `queryKeys.ts`는 `auth.me`·`admin.users`를 가진다.
  AI 채팅은 `useChat`(Vercel AI SDK) transport가 `/api/agent`를 직접 호출.
- 클라이언트 상태: `challengeStore`(과제/루브릭/AI정책 CRUD — 피벗), `workspaceStore`(과제별 풀이 영속 — 파일 델타+AI 사용량, IndexedDB, 피벗 P4), `submissionStore`(과제별 제출 — 채점결과+제출코드+AI프롬프트, 교수 대시보드 소스, 피벗), `problemStore`(알고리즘 문제), `solveSessionStore`(문제별 코드·언어·AI 사용량), `solveHistoryStore`(문제별 마지막 채점 결과 — 마이페이지 소스).

### Zustand persist 규칙
- store별 **고유 persist key** (`'despy-{domain}'`)
- 현재 persist key: `challengeStore → 'despy-challenges'` (v4, 피벗 — 루브릭 레벨 anchor(v2) + 풀스택 샘플 시드 보강 additive migrate(v3) + ML 챌린지 kind 필수화 backfill(v4: 기존 과제 kind:'workspace')), `workspaceStore → 'despy-workspace'` (v1, 피벗 P4 — **IndexedDB** 백엔드, `idbStorage` 어댑터), `submissionStore → 'despy-submissions'` (v2, 피벗 — localStorage · v2에서 integrityLog(시험 감독 로그) 필드 추가 — optional·무변환 migrate), `problemStore → 'despy-problems'` (v1, 알고리즘), `solveSessionStore → 'despy-solve-session'` (v1), `solveHistoryStore → 'despy-solve-history'` (v1 — 알고리즘 채점 결과 이력)
- persist 스키마 변경 시 `version` 번호 올리고 `migrate()` 작성 **필수** (안 하면 기존 사용자 앱 깨짐)
- persist 스토어를 읽는 화면은 `useHasMounted`로 마운트 이후 렌더(hydration mismatch 방지). **비동기 storage(IndexedDB)** 는 추가로 store의 `hasHydrated` 플래그로 rehydrate 완료를 게이트한다(`workspaceStore` → `useWorkspace` boot 시퀀스).

---

## 코드 컨벤션 (상세: `docs/conventions.md`)

### 파일 상단 JSDoc (모든 파일 필수)
```typescript
/**
 * 파일명.ts — 한줄 요약
 *
 * 상세 설명 (무엇을, 왜, 어떻게)
 *
 * 사용처: 어디에서 사용되는지
 */
```

### 파일 내 레이어 순서
| 파일 타입 | 순서 |
|---|---|
| 컴포넌트 | Imports → Constants → Types → Component 함수 → Styled Components |
| 훅 | Types → Hook 함수 (Refs → State → Callbacks → Effects → Return) |
| Store | Types → 초기 상태 → Store 정의 → Selector 헬퍼 |

### 네이밍 — 이름만으로 역할 파악 (길고 명확 > 짧고 모호)
```tsx
// boolean: is / should / has 접두사 + 주어 명시
isScrollFocused        // ✅    isActive (❌ 모호)
// 콜백: on + 명사 + 동사
onItemSelectRequest    // ✅    onSelect (❌ 무엇의?)
```

### 금지 사항
- `any` 타입 금지 · 인라인 스타일 지양 · 하드코딩 색상 금지(테마 사용)
- `console.log` 커밋 금지(`logger` 사용) · 기존 주석 삭제/축약 금지

---

## 의사결정 체크포인트 (작업 중 판단 기준)

### 반드시 멈추고 물어볼 것 (Blocking)
아키텍처 변경 · 새 라이브러리 도입 · 데이터 모델/persist 스키마 변경 · 레이어 규칙 예외 · 폴더 구조 변경 · Breaking Change · UX 변경
→ **코드 작성 전** 선택지(장단점·영향 범위·예시)를 제시하고 승인받기.

### 멈추지 않고 진행할 것 (Autonomous)
버그 수정 · 타입 에러 해결 · 컨벤션 정리 · 기존 패턴과 동일한 코드 추가 · import 경로/리네이밍 전파.

### 언급만 하고 진행할 것 (Inform)
성능 영향 선택(memo 등) · 여러 방법 중 선택 시 근거 · 예상보다 영향 범위가 클 때.

---

## 문서 동기화 규칙 (코드 수정 후 필수)

코드를 수정하면 관련 문서를 확인하고 불일치 시 즉시 업데이트한다.

| 수정한 코드 | 확인할 문서 |
|---|---|
| `features/*` 추가/삭제/이동 | CLAUDE.md 디렉토리 구조 |
| store/query 추가/변경 | CLAUDE.md persist key·queryKeys |
| 파일/컴포넌트명 변경 | CLAUDE.md + 관련 문서 |
| 레이어 import 패턴 변경 | CLAUDE.md 레이어 규칙 |

**작업 완료 체크리스트**
```
□ npm run typecheck (tsc --noEmit) 통과
□ npm run lint 통과 (레이어 규칙 포함)
□ 위 매핑 테이블에서 해당 문서 확인·업데이트
□ 구조/타입/규칙 변경 시 CLAUDE.md 갱신
```

---

## 커밋 컨벤션

> git 명령 실행은 유저가 직접 한다. AI는 커밋 메시지 초안만 제시.

```
<type>(<scope>): <subject>

<body>  ← 선택, 왜 변경했는지
```
type: `feat` · `fix` · `refactor` · `docs` · `style` · `chore`
scope: 변경된 feature 또는 shared 레이어명
