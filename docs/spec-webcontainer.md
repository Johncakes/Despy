# despy 명세서 — 실시간 AI 바이브코딩 코테 (WebContainer 피벗)

> **상태: 확정 · 구현 대기 (P0 착수 가능)**
> 이 문서는 despy를 "알고리즘 + Judge0 채점"에서 **"실시간 웹 개발환경 + AI 바이브코딩 + AI 정성 채점"** 으로
> 피벗하기 위한 전체 명세다.
> **전면 재작성(클린 슬레이트) 승인됨(2026-06-24)** — 구 데이터 보존 불필요, §13의 Blocking 결정 4건 확정.

> 문서 지도
> - [`CLAUDE.md`](../CLAUDE.md) — AI 에이전트용 프로젝트 지도(레이어 규칙·컨벤션)
> - [`docs/architecture.md`](./architecture.md) — **기존 MVP** 동작 설명(피벗 전)
> - **이 문서** — 피벗 목표 아키텍처(WebContainer 기반)

---

## 1. 피벗 개요

### 1.1 변경된 방향성

| | 기존 MVP | **신규 (이 문서)** |
|---|---|---|
| 평가 대상 | 알고리즘 문제 풀이 | **실무형 웹 개발 과제** (UI 구현·기능 추가) |
| 실행 환경 | 서버측 Judge0(Docker) | **브라우저 내 WebContainer** (실제 Node 런타임) |
| 과제 형태 | 입력→출력 표준입출력 | **프로젝트 파일트리** (주어진 백엔드/API + 학생 작업영역) |
| 채점 | 입출력 일치(Judge0) | **자동 테스트 + AI 루브릭 정성 채점** 하이브리드 |
| 예시 | Two Sum | "백엔드 로직 주고 장바구니 UI 구현" / "API 주고 장바구니 삭제 기능 바이브코딩" |

### 1.2 평가 철학 (불변)

AI 코딩 도구가 보편화된 환경에서 **"AI를 효과적으로 부려 문제를 푸는 능력"** 을 정량 평가한다.
교수는 과제·제약·채점 기준을 통제하고, 학생은 제한된 AI 자원으로 **실제로 돌아가는 코드**를 만든다.
바뀐 것은 "무엇을 푸는가"(알고리즘 → 실무형 웹 과제)와 "어디서 실행하는가"(서버 → 브라우저)다.

### 1.3 살아남는 핵심 자산

피벗은 처음부터 다시 짓는 게 아니다. 다음은 그대로 재활용한다:

- **AI 채팅 + 스트리밍** (`/api/agent`, Gemini, `useChat`)
- **실시간 코드 미러링** ([`markdownCode.ts`](../src/shared/lib/utils/markdownCode.ts) — AI 답변 코드펜스 추출)
- **AI 정책 통제** (모델 고정·질문/토큰 한도·시스템 프롬프트 = `AiPolicy`)
- **교수 출제 / 학생 풀이 3열 레이아웃 골격**
- **레이어 규칙·컨벤션·상태관리 원칙** (features → shared 단방향)

폐기/대체: **Judge0 채점 경로** (`/api/judge`, `judgeApi`, `judgeQueries`, `GradingRequest` 표준입출력 모델).

---

## 2. 시스템 아키텍처

> **갱신(2026-06-24): 백엔드 최소화 원칙 해제.** 코드 실행·미리보기는 여전히 브라우저(WebContainer)에서
> 일어나지만, **채점 무결성을 위해 제출 시점의 공식 점수는 서버에서 재실행/검증**한다(§13 결정6).
> 서버는 더 이상 "프록시 전용"이 아니라 **채점 권한의 경계**를 갖는다.

학생의 풀이 중 즉시 피드백(편집·미리보기·자동 테스트 미리보기)은 브라우저(WebContainer)에서 처리하고,
서버 라우트는 **AI 프록시 + 채점(루브릭 정성 채점 + 제출 시 테스트 재실행)** 을 맡는다.

```
┌───────────────────────────── 브라우저 (Next.js 클라이언트) ─────────────────────────────┐
│                                                                                          │
│  교수 ── /author ──►  ChallengeAuthorView ── problemStore (localStorage 'despy-problems') │
│                              │ 파일트리·잠금경로·테스트·루브릭·AI정책 출제                  │
│                              ▼ (같은 출처를 읽음)                                          │
│  학생 ── /solve/[id] ──► SolveView                                                        │
│        │                                                                                 │
│        ├─ AiChatPanel ──(useChat)──────────────────────────────► POST /api/agent ──► Gemini
│        │     └─ AI 답변 코드펜스 → 미러링                                                  │
│        │                                                                                 │
│        ├─ WorkspacePanel ── Monaco 에디터 ◄──► WebContainer FS                            │
│        │     │  ┌──────────────── WebContainer (브라우저 내 Node) ───────────────┐        │
│        │     │  │  mount(파일트리) → npm install → npm run dev ──► 미리보기 iframe │        │
│        │     │  │                              npm test ──► 테스트 결과 캡처       │        │
│        │     │  └──────────────────────────────────────────────────────────────┘        │
│        │                                                                                 │
│        └─ 제출 ─► 1) WebContainer 자동 테스트 결과 + 2) 코드/diff/루브릭                    │
│                     └──────────────────────────────────► POST /api/grade ──► Gemini       │
│                                                          (루브릭 정성 채점, JSON 점수)      │
└──────────────────────────────────────────────────────────────────────────────────────────┘

핵심: 풀이 중 실행·미리보기·테스트 미리보기는 브라우저(WebContainer),
      제출 시 공식 채점(테스트 재실행 + 루브릭)은 서버(grade)에서 확정.
```

### 2.1 ⚠️ 전제조건: Cross-Origin Isolation (가장 중요한 제약)

WebContainer는 `SharedArrayBuffer`를 쓰므로 페이지가 **cross-origin isolated** 상태여야 한다.
즉 앱을 서빙하는 모든 응답에 다음 헤더가 **필수**다:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp   (또는 credentialless)
```

영향:
- Next.js에서 `next.config` 헤더 설정 또는 미들웨어로 전역 주입 필요.
- COEP가 걸리면 **모든 외부 리소스(이미지·폰트·스크립트·iframe)** 가 CORP/CORS를 만족해야 로드된다.
  → 외부 CDN·구글 폰트 등 사용 시 깨질 수 있어 **초기에 점검 필수**.
- 배포 환경(Vercel 등)에서도 동일 헤더가 적용되는지 확인해야 한다.
- WebContainer는 **탭당 1개 인스턴스**만 부팅 가능(`boot()` 1회). 전역 싱글턴으로 관리.

> 이 제약은 PoC 0순위 검증 항목이다. 헤더가 안 잡히면 WebContainer 자체가 부팅 실패한다.

### 2.2 ⚠️ COEP 부작용: Monaco 에디터가 깨진다 (P0 직접 차단)

`@monaco-editor/react`는 기본적으로 **CDN(jsdelivr)에서 에디터 워커를 로드**한다. COEP를 켜면
CORP 헤더 없는 cross-origin 리소스가 전부 차단되어 **Monaco가 부팅 실패**한다. WebContainer 헤더와
정면충돌하는 가장 흔한 함정이다.

대응 (택1, P0에서 검증):
- **Monaco 자체 호스팅** — `monaco-editor`를 직접 import하고 `loader.config({ monaco })`로 CDN 대신
  로컬 번들을 쓴다. (require-corp 유지 가능, 가장 견고)
- **COEP `credentialless` 사용** — 외부 리소스를 자격증명 없이 로드 허용해 깨짐을 줄인다. 단 Safari 지원 약함.

> **COEP 모드 결정**: 타깃에 Safari가 없으면 개발 편의상 `credentialless`로 시작, 있으면 `require-corp`
> + 모든 리소스(Monaco·폰트) 자체 호스팅. → §13 추가 결정 항목.

---

## 3. WebContainer 런타임 설계

### 3.1 라이프사이클

```
1. boot()            WebContainer 인스턴스 부팅 (탭당 1회, 전역 싱글턴)
2. mount(fileTree)   문제 템플릿 파일트리를 가상 FS에 적재
3. spawn('npm',['install'])   의존성 설치 (진행 로그를 콘솔 패널로 스트리밍)
4. spawn('npm',['run','dev']) dev 서버 기동
5. on('server-ready', (port, url) => 미리보기 iframe.src = url)
6. 학생 편집 → fs.writeFile(path, content)  (Monaco ↔ FS 동기화)
7. 제출 → spawn('npm',['test','--','--reporter=json']) → stdout 캡처 → 파싱
```

### 3.2 책임 분리 (레이어 규칙 준수)

WebContainer 제어 로직은 **`shared/lib`** 에 두고, feature는 훅/콜백으로만 접근한다.
`shared`는 `features`를 import할 수 없으므로(레이어 규칙), 워크스페이스 상태 주입은 props/DI로 한다.

| 책임 | 위치(제안) | 비고 |
|---|---|---|
| WebContainer 부팅·mount·spawn 래퍼 | `shared/lib/webcontainer/runtime.ts` | 싱글턴 boot, 저수준 API 캡슐화 |
| FS ↔ 에디터 동기화 | `shared/lib/webcontainer/fileSync.ts` | writeFile/readFile 디바운스 |
| 테스트 실행·결과 파싱 | `shared/lib/webcontainer/testRunner.ts` | reporter JSON → 도메인 타입 |
| React 통합 훅 | `features/solve/useWorkspace.ts` | 부팅 상태·미리보기 URL·로그·실행 |
| UI | `features/solve/components/WorkspacePanel.tsx` | 에디터+미리보기+콘솔 탭 |

### 3.3 파일 동기화 모델

- **단일 출처는 WebContainer FS가 아니라 세션 스토어**가 아니다 — 충돌 방지를 위해
  **에디터(메모리) → FS** 단방향 쓰기를 기본으로 한다. (학생 편집 → debounce → `fs.writeFile`)
- AI 미러링도 동일 경로: AI가 코드를 쓰면 활성 파일 버퍼 갱신 → FS 반영 → dev 서버 HMR로 미리보기 자동 갱신.
- **잠금 파일**(`lockedPaths`)은 FS에는 존재하되 에디터에서 read-only로 표시하고 쓰기를 막는다.

### 3.4 테스트 스택 & 취약성 대응 (채점 신뢰성의 핵심)

**스택 확정**: 채점 테스트는 `Vitest + @testing-library/react + jsdom(또는 happy-dom)`.
- ✅ Vitest는 Node 기반이라 WebContainer에서 그대로 실행된다.
- ❌ **Playwright/e2e는 불가** — WebContainer는 실제 브라우저 바이너리를 띄울 수 없다(WASM Node 런타임). 명세 전반에서 제외.

**취약성 문제**: 자동 테스트는 "정해진 모양"만 채점하는 깐깐한 채점관이라, 학생/AI가 **다른 구조로
올바르게 구현해도 떨어질 수 있다**(false negative). 바이브코딩은 해법이 제각각이라 이 위험이 크다.

**3중 대응**:
1. **행동(behavior) 기준 테스트** — 내부 함수명·클래스가 아니라 **사용자에게 보이는 결과**를 검증한다.
   Testing Library 철학(`getByRole`/`getByText`로 조회, 구현 디테일 비검증)을 따른다.
   예) ❌ `deleteItem 함수 호출 확인` → ✅ `'삭제' 버튼 클릭 시 해당 상품이 목록에서 사라짐`.
2. **AI 루브릭 채점으로 보완** — 테스트가 놓친 "다르지만 유효한" 구현은 AI가 의도를 읽어 평가(§7.2).
3. **계약(contract)을 지문에 명시** — 테스트가 의존하는 약속(예: "삭제 버튼 텍스트는 '삭제'",
   "export 함수 시그니처")을 문제 지문/요구사항에 적어, 학생이 그 약속만 지키면 내부는 자유롭게 짠다.

**프로세스 가드**: 학생/AI 코드에 무한 루프·무한 빌드가 섞이면 탭이 멈춘다. `runtime.ts`의 `spawn`
래퍼에 **타임아웃 + kill** 가드를 둔다(특히 test 실행).

---

## 4. 데이터 모델 (신규)

[`shared/core/types/index.ts`](../src/shared/core/types/index.ts)를 확장한다. 기존 `Problem`/`TestCase`/
`GradingRequest`(표준입출력)는 **deprecated**, 아래 모델로 대체.

### 4.1 프로젝트 파일트리

```ts
/** WebContainer가 mount하는 파일트리. 경로→파일 내용 평면 맵으로 보관하고
 *  런타임에서 WebContainer FileSystemTree 형태로 변환한다. */
export type ProjectFiles = Record<string, string>; // { 'src/App.tsx': '...', 'package.json': '...' }
```

### 4.2 과제(Challenge) — 신규 출제 단위

```ts
export interface ChallengeProblem {
  id: string;
  title: string;
  /** 마크다운 지문 (요구사항·시나리오) */
  statement: string;

  // ── 워크스페이스 ──
  /** 학생에게 주어지는 시작 파일트리 (주어진 백엔드/API 포함) */
  template: ProjectFiles;
  /** 학생이 편집할 수 없는 경로(주어진 API·골격). 에디터 read-only */
  lockedPaths: string[];
  /** 학생 주 작업 영역 경로(강조 표시용, 비면 lockedPaths의 보수) */
  editablePaths: string[];

  // ── 실행 명령 ──
  setupCommands: string[]; // 예: ['npm install']
  devCommand: string;      // 예: 'npm run dev'
  testCommand: string;     // 예: 'npm test'

  // ── 채점 ──
  /** 채점용 테스트 파일트리(학생 비노출, 제출 시점에 FS에 주입) */
  testFiles: ProjectFiles;
  /** AI 정성 채점 기준 */
  rubric: GradingRubric;

  // ── AI 통제 (기존 재활용) ──
  aiPolicy: AiPolicy;

  createdAt: number;
  updatedAt: number;
}
```

### 4.3 채점 루브릭

```ts
export interface RubricCriterion {
  id: string;
  /** 채점 항목 설명 (예: "장바구니가 비었을 때 예외 처리") */
  description: string;
  /** 이 항목 만점 */
  maxScore: number;
}

export interface GradingRubric {
  criteria: RubricCriterion[];
  /** 최종 점수 가중치 (합 1.0) */
  weights: {
    /** 자동 테스트 통과율 비중 */
    tests: number;
    /** AI 루브릭 점수 비중 */
    rubric: number;
  };
}
```

### 4.4 채점 결과

```ts
/** 자동 테스트(WebContainer 내 실행) 결과 */
export interface AutoTestResult {
  passedCount: number;
  totalCount: number;
  cases: { name: string; passed: boolean; message?: string }[];
}

/** AI 루브릭 채점(Gemini) 결과 */
export interface RubricGradingResult {
  scores: { criterionId: string; score: number; reason: string }[];
  totalScore: number;
  maxScore: number;
  feedback: string;
}

/** 종합 채점 결과 */
export interface ChallengeGradingResult {
  problemId: string;
  autoTest: AutoTestResult;
  rubric: RubricGradingResult;
  /** weights로 가중합한 최종 점수(0~100) */
  finalScore: number;
  submittedAt: number;
}
```

---

## 5. 교수(출제) 플로우

`/author` → `ChallengeAuthorView`. 기존 `ProblemForm`/`TestCaseEditor`를 과제형으로 교체한다.

1. **기본 정보**: 제목, 마크다운 지문(요구사항).
2. **시작 프로젝트 구성**: 파일트리 편집기로 `template` 작성.
   - 프리셋 템플릿(예: Vite+React 장바구니 스타터) 선택 → 일부 파일을 비워 학생 작업영역으로.
   - 각 파일에 **잠금/편집 가능** 토글(`lockedPaths`) — "주어진 API·백엔드 로직" 표현.
3. **실행 명령**: setup/dev/test 명령 설정(기본값 제공).
4. **채점 설정**:
   - `testFiles`: 자동 채점 테스트 작성(학생 비노출).
   - `rubric`: 루브릭 항목(예외처리 등)·만점·가중치 입력.
5. **AI 정책**: 기존 `AiPolicyFields` 재활용(모델·질문/토큰 한도·시스템 프롬프트).
6. 저장 → `problemStore.upsertProblem` → "풀기"로 학생 화면 이동.

> MVP 단순화: 파일트리 편집기는 초기엔 "프리셋 + 일부 파일 텍스트 편집" 수준으로 시작하고,
> 본격 트리 편집 UI는 후속 단계로 미룬다(§12 로드맵).

---

## 6. 학생(풀이) 플로우

`/solve/[problemId]` → `SolveView`. 3열 레이아웃 유지하되 우측을 워크스페이스로 강화.

```
┌── 좌: ProblemPanel ──┬── 중: AiChatPanel ──┬── 우: WorkspacePanel ─────────────┐
│  마크다운 지문        │  AI 도우미(주역)     │  [에디터] [미리보기] [콘솔] 탭      │
│  요구사항·제약        │  남은 질문/토큰 게이지 │  Monaco ↔ WebContainer FS         │
│                      │  AI 직접 편집 토글    │  ▶ dev 서버 미리보기 iframe        │
│                      │                      │  ▶ npm test 실행 → 결과            │
└──────────────────────┴──────────────────────┴────────────────────────────────────┘
         제출 → 자동 테스트 + AI 루브릭 채점 → 최종 점수/피드백 패널
```

플로우:
1. 진입 시 `WebContainer.boot()` → `mount(template)` → `npm install` (콘솔에 진행 로그).
2. `npm run dev` 기동 → `server-ready` 이벤트 → 미리보기 iframe 표시.
3. 학생이 AI에 질문 → AI가 코드 작성 → **미러링**으로 에디터/FS 갱신 → HMR로 미리보기 자동 갱신.
4. 학생 직접 편집도 가능(잠금 파일 제외).
5. **제출**:
   - `testFiles`를 FS에 주입 → `npm test --reporter=json` → 결과 캡처(`AutoTestResult`).
   - 학생 코드 + 변경 diff + 루브릭을 `/api/grade`로 전송 → `RubricGradingResult`.
   - 가중합 → `ChallengeGradingResult` → 결과 패널 표시.

AI 한도(질문/토큰) 동작은 기존과 동일(§ architecture.md 4장) — 코드 생성도 동일 한도를 소비한다.

---

## 7. 백엔드 계약 (Route Handlers)

라우트 2개다(`/api/judge`는 제거). `/api/agent`는 얇은 AI 프록시지만, `/api/grade`는
백엔드 최소화 해제(2026-06-24 §13 결정6) 이후 **채점 권한의 경계**로서 단순 프록시 이상이다 —
제출 시 테스트 재실행 + 루브릭 채점을 서버에서 확정한다.

### 7.1 `POST /api/agent` — AI 프록시 (기존 유지)

변경 없음. Gemini 스트리밍 + 토큰 usage. ([architecture.md §3.1](./architecture.md))

### 7.2 `POST /api/grade` — 공식 채점 (서버 재실행 + AI 루브릭, 신규)

> **무결성**: `autoTest`는 풀이 중 클라이언트가 본 *즉시 피드백*일 뿐 공식 점수가 아니다.
> 공식 점수는 서버가 `submittedFiles`+`testFiles`로 **테스트를 재실행**해 산출한다(P3 이후 샌드박스 인프라).
> 클라이언트가 보낸 `autoTest`는 참고용/표시용으로만 받고 점수 산정에는 신뢰하지 않는다.

**요청**
```jsonc
{
  "problemId": "cart-delete",
  "statement": "요구사항 마크다운",
  "rubric": { "criteria": [...], "weights": {...} },
  "submittedFiles": { "src/Cart.tsx": "..." },   // 학생 변경 파일
  "diff": "선택: 템플릿 대비 변경 diff",
  "autoTest": { "passedCount": 3, "totalCount": 4, "cases": [...] },
  "model": "gemini-2.5-flash",
  "systemPrompt": "채점 가드레일(교수 설정)"
}
```

**처리**
1. `GEMINI_API_KEY` 확인.
2. 루브릭·코드·테스트결과를 채점 프롬프트로 구성, **구조화 출력(JSON 스키마)** 요구
   (`generateObject` / structured output)로 `RubricGradingResult` 강제.
3. 서버에서 `weights`로 자동테스트 통과율 + 루브릭 점수를 가중합해 `finalScore` 계산.

**응답**: `ChallengeGradingResult`.

> 채점 LLM은 **현 결정상 Gemini 유지.** (정확도 우선 시 Claude로 채점기만 교체 가능 — 후속 논의)

---

## 8. 디렉토리 구조 변경

```
app/
  api/agent/route.ts          (유지)
  api/grade/route.ts          (신규 — 루브릭 채점)
  api/judge/route.ts          (삭제)

features/
  author/   ChallengeAuthorView · FileTreeEditor · RubricEditor · AiPolicyFields(유지)
            useChallengeDraft  (← useProblemDraft 대체)
  solve/    SolveView · ProblemPanel(유지) · AiChatPanel(유지)
            WorkspacePanel · PreviewPane · ConsolePane · useWorkspace
            ChallengeGradingResultPanel  (← GradingResultPanel 대체)

shared/
  core/api        gradeApi  (← judgeApi 대체)
  core/queries     gradeQueries  (← judgeQueries 대체)
  core/types       ChallengeProblem · GradingRubric · ChallengeGradingResult …
  core/stores      problemStore(스키마 변경) · solveSessionStore(스키마 변경)
  core/constants   sampleChallenges  (← sampleProblems 대체) · webcontainerTemplates
  lib/webcontainer runtime · fileSync · testRunner   (신규)
  lib/utils        markdownCode(유지) · logger(유지)
```

레이어 규칙 불변: `shared/lib/webcontainer/*`는 외부 라이브러리(`@webcontainer/api`)만 의존,
feature가 훅으로 감싼다. `shared → features` 금지 유지.

---

## 9. 상태 관리 & persist 마이그레이션

### 9.1 persist 스토어 — 클린 슬레이트 (마이그레이션 없음)

전면 재작성이 승인되어 **구 데이터를 보존하지 않는다.** `migrate()` 없이 **새 persist key**로 시작하면
구 키(`despy-problems` v1 등)는 자연히 읽히지 않고 무시된다(무인증 로컬 데이터라 허용).

| 스토어 | 신규 key | 보관 내용 |
|---|---|---|
| `problemStore` | `despy-challenges` (v1) | `ChallengeProblem[]` |
| `solveSessionStore` | `despy-workspace` (v1) | 문제별 파일 버퍼(`files: ProjectFiles`)·활성 파일·AI 사용량 |

구 키(`despy-problems`/`despy-solve-session`)는 정리 차원에서 첫 로드 시 제거(선택).

**저장소 주의 (localStorage quota)**: 파일트리를 localStorage(~5MB)에 통째로 넣으면 몇 문제 만에
초과한다. 따라서 `solveSessionStore`(`despy-workspace`)는:
- **IndexedDB**를 백엔드로 사용한다(zustand `persist`의 `createJSONStorage` + idb 어댑터).
- **템플릿 대비 학생이 변경한 파일(delta)만 저장**하고, 나머지는 `template`에서 복원한다.

### 9.2 상태 관리 원칙 (불변)

- 서버 데이터(LLM 채점) = TanStack Query **mutation**(`useGradeChallenge`).
- 클라이언트 상태 = Zustand. WebContainer 인스턴스는 React state가 아니라 `shared/lib` 싱글턴 + 훅 구독.
- WebContainer FS 내용을 Zustand에 복사 저장하지 않는다(에디터 버퍼가 작업본, FS가 실행본).

---

## 10. 기술 스택 변경

| 영역 | 추가/변경 | 비고 |
|---|---|---|
| 실행환경 | **`@webcontainer/api`** (신규) | 브라우저 내 Node. 상업 프로덕션 유료(§11) |
| 모킹 API | **`msw`** (신규, 선택) | "API만 제공" 시나리오용 모킹 |
| 자동 테스트 | 과제 템플릿 내 **Vitest + @testing-library/react + jsdom** | WebContainer에서 실행. **Playwright/e2e 불가**(브라우저 바이너리 없음) |
| 헤더 | Next.js COOP/COEP 설정 (신규) | cross-origin isolation(§2.1) |
| 제거 | Judge0 (`docker-compose.judge0.yml`, `JUDGE0_*`, `docs/judge0.md`) | 알고리즘 채점 폐기 |
| AI | 기존 Vercel AI SDK + Gemini (유지) | 채팅·미러링·채점 |
| 서버 채점 샌드박스 | **추가(P3 이후)** — 제출 시 테스트 재실행 | 백엔드 최소화 해제로 가능(§13 결정6) |
| MongoDB | 현재 미사용 | 영속 필요 시 저장소는 사안별 결정(지양 원칙 완화) |

---

## 11. 라이선스 & 비용

### WebContainer (StackBlitz)
- 공식 약관(webcontainers.io): **"production usage in a commercial, for-profit setting"** 시 라이선스 필요.
  **"Prototypes or POCs do not require a commercial license."**
- **PoC/프로토타입 단계는 무료** → 초기 개발·검증은 비용 0.
- 운영 배포 시: 본 서비스가 **비영리**라면 "for-profit"에 해당하지 않을 가능성이 높으나
  약관에 비영리 면제가 **명시되어 있지 않음** → **프로덕션 배포 전 StackBlitz에 직접 확인** 필요.
- Sandpack(MIT, 완전 무료)이 백업 선택지. 풀스택 요구가 약하면 전환 가능.

### Gemini
- 기존과 동일. 채팅 + 채점 호출량 증가分 비용 모니터링.

---

## 12. 단계별 로드맵

| 단계 | 목표 | 완료 기준 |
|---|---|---|
| **P0 PoC** ✅ | WebContainer가 브라우저에서 부팅·미리보기 되는지 | **완료(2026-06-24)** — COOP/COEP 헤더 적용 → boot→mount→`npm install`→`npm run dev`→iframe 미리보기 성공(`/playground`). headless Chrome로 자동 검증(crossOriginIsolated=true, ~20초). |
| **P1 워크스페이스** ✅ | Monaco ↔ FS 동기화 + AI 미러링 경로 | **완료(2026-06-24)** — 2-pane(파일트리+Monaco ↔ 미리보기), 편집/AI 데모 모두 동일 `writeFile`(debounce)→FS→`[vite] hmr update` 실측. 잠금 파일 read-only. 실제 AiChatPanel 연결·persist(`despy-workspace`)는 P4로. |
| **P2 자동 채점** | WebContainer 내 `npm test` 결과 캡처 | `AutoTestResult` 파싱·표시 |
| **P3 AI 루브릭 채점** | `/api/grade` + 가중합 | `ChallengeGradingResult` 최종 점수 |
| **P4 출제 도구** | `ChallengeAuthorView`(템플릿·잠금·테스트·루브릭) | 교수가 과제 1개 풀 출제 |
| **P5 정리** | Judge0 경로 제거·문서 동기화 | architecture.md/CLAUDE.md 갱신 |

> P0는 단독 검증 가치가 큼 — 헤더·라이선스·미리보기 가능성을 한 번에 확인한다.

---

## 13. 리스크 & 미해결 질문

| 항목 | 리스크 | 대응 |
|---|---|---|
| cross-origin isolation | 헤더 미적용 시 WebContainer 부팅 실패, 외부 리소스 깨짐 | P0에서 최우선 검증, 외부 CDN 의존 최소화 |
| 부팅·`npm install` 지연 | 진입 시 수초 대기, 학생 PC 성능 의존 | 의존성 최소 템플릿, 진행 로그 UX, 캐싱 검토 |
| 상업 라이선스 | 비영리라도 프로덕션 시 회색지대 | 배포 전 StackBlitz 문의, Sandpack 백업 |
| persist 데이터 손실 | v1→v2 마이그레이션 시 기존 로컬 문제 폐기 | 무인증 MVP라 허용 가정 — **확인 필요** |
| 채점 신뢰성 | LLM 루브릭 채점의 일관성·변별력 | 구조화 출력·few-shot·자동테스트 가중치로 보정 |
| 보안/격리 | 무인증이라 테스트파일·루브릭이 클라이언트 노출 | MVP 한계 동일(UX 수준), 서버세션은 범위 밖 |
| **Monaco × COEP** | COEP 켜면 CDN 로드 Monaco 부팅 실패 | 자체 호스팅 또는 credentialless(§2.2) — **P0 직접 차단** |
| **채점 무결성** | 채점이 클라이언트에서 실행→점수 위조·테스트파일 열람 가능 | **제출 시 서버 재실행 하이브리드 채택**(결정 6) — 공식 점수는 서버가 확정 |
| **테스트 취약성** | 모양 다르면 정답도 오답 처리(false negative) | 행동 기준 테스트 + AI 보완 + 계약 명시(§3.4) |
| **localStorage quota** | 파일트리 통째 저장 시 용량 초과 | IndexedDB + delta 저장(§9.1) |

### 확정된 결정 (전면 재작성 승인 — 2026-06-24)
1. **마이그레이션 없음(클린 슬레이트)** — 새 persist key(`despy-challenges`/`despy-workspace`)로 시작, 구 데이터 폐기(§9.1).
2. **Judge0 완전 제거** — `/api/judge`·`judgeApi`·`judgeQueries`·`GradingRequest`·`docker-compose.judge0.yml`·`docs/judge0.md`·`JUDGE0_*`·`languages`의 `judge0Id`까지 삭제.
3. **채점 LLM = Gemini 유지** — 단 `shared/lib`에서 채점기를 추상화(`grader` 인터페이스)해 후일 Claude 교체를 1파일로 가능하게.
4. **출제 파일트리 = 프리셋 + 파일 단위 편집/추가/잠금 토글로 시작** — 드래그앤드롭 풀 트리 편집 UI는 후속 단계.

### 추가 결정 (2026-06-24 확정)
5. **COEP 모드 = `require-corp`** — 코드(`next.config.ts`·`runtime.ts`)에 이미 적용됨. §2.2.
6. **채점 무결성 = (b) 서버 재실행 하이브리드 채택** (백엔드 최소화 원칙 해제로 가능, 2026-06-24).
   단계적 구현: **P2**는 WebContainer 내 테스트 캡처로 *즉시 피드백*만 제공(클라이언트, 비공식),
   **제출 시점의 공식 점수**는 `/api/grade`가 **서버에서 테스트 재실행 + 루브릭 채점**으로 확정한다.
   서버 샌드박스 인프라(예: e2b)는 P3 이후 별도 단계로 붙인다. §7.2.
7. **테스트 스택 = Vitest + Testing Library + jsdom 확정** (Playwright 제외). §3.4.
8. **파일 저장소 = IndexedDB + delta** 확정. §9.1.

---

## 14. 아키텍처 원칙 부합성 체크

| CLAUDE.md 원칙 | 부합 여부 |
|---|---|
| ~~백엔드 최소화~~ → 백엔드 가치 우선 | ✅ 해제(2026-06-24). 실행·미리보기는 브라우저, 채점 무결성은 서버 |
| ~~MongoDB 지양~~ → 사안별 결정 | ✅ 완화. 현재 미사용, 영속 도입 시 저장소 선택 |
| features → shared 단방향 | ✅ WebContainer는 `shared/lib`, feature는 훅으로 주입 |
| 서버상태=Query / 클라=Zustand | ✅ 채점 mutation, 워크스페이스는 싱글턴+스토어 |
| persist 스키마 변경 시 version+migrate | ✅ 클린 슬레이트 — 새 key로 시작, migrate 불필요(§9.1) |

---

> **다음 행동**: 본 명세 합의 후 **P0 PoC**(WebContainer 부팅 + 미리보기)부터 착수.
> §13의 Blocking 결정 4건은 P0 착수와 병행해 확정한다.
