# 구현 진행 기록 — WebContainer 피벗

> 이 문서는 WebContainer 피벗(P0~) 구현 이력을 대화 간 맥락 인계용으로 정리한 것이다.
> 전체 명세는 [spec-webcontainer.md](./spec-webcontainer.md), AI 지도는 [CLAUDE.md](../CLAUDE.md).
> **최종 갱신: 2026-06-24**

---

## 한눈 요약 (2026-06-24 기준)

| 단계 | 목표 | 상태 |
|---|---|---|
| **P0** | WebContainer 부팅 + 미리보기 | ✅ 완료·검증 |
| **P1** | 편집/AI 미러링 → FS → HMR + 실제 풀이 화면 | ✅ 완료·검증 (`/playground` + `/workspace/[id]`) |
| **P2** | WebContainer 내 `npm test` 결과 캡처 | ✅ 완료 (테스트 탭·`runTests`·vitest 템플릿) |
| **P3** | AI 루브릭 채점 + 가중합 | 🟡 백엔드·데이터 ✅ / **제출 UI 미연결** |
| **P4** | 출제 도구 + 제출 플로우 + 워크스페이스 persist | 🟡 출제 도구 ✅ / 워크스페이스 persist 미착수 |
| **P5** | 구 Judge0/Problem 경로 제거 | ❌ 미착수 |

**핵심 방향 변경(2026-06-24)**: 백엔드 최소화 원칙 **해제**. 채점 무결성을 위해 공식 점수는
서버(`/api/grade`)가 확정한다(§13 결정6). 채점 무결성 = (b) 서버 재실행 하이브리드 채택.

**빌드 상태**: `npm run typecheck` ✅ · `npm run lint`(레이어 규칙 포함) ✅ · `npm run test` ✅ (5파일 34테스트).

---

## 완료 단계

### P0 — WebContainer PoC (완료 2026-06-24)

**목표**: WebContainer가 브라우저에서 실제로 부팅·미리보기되는지 검증.

| 파일 | 내용 |
|---|---|
| `next.config.ts` | COOP(`same-origin`) + COEP(`require-corp`) 헤더 전역 주입 |
| `src/shared/lib/webcontainer/runtime.ts` | WebContainer 싱글턴 부트 래퍼 신규 |
| `src/shared/core/constants/webcontainerTemplates.ts` | `VITE_REACT_SAMPLE_TEMPLATE` + `VITE_REACT_SAMPLE_LOCKED_PATHS` 신규 |
| `src/features/solve/useWorkspace.ts` | 워크스페이스 훅 초기 버전 (phase/logs/previewUrl) |
| `src/features/solve/components/WorkspacePanel.tsx` | 미리보기 iframe + 콘솔 패널 신규 |
| `src/features/solve/WorkspacePlaygroundView.tsx` · `src/app/playground/page.tsx` | `/playground` PoC 뷰·라우트 |

**검증 (headless Chrome + CDP)**: 모든 응답에 COOP/COEP 헤더 · `crossOriginIsolated === true` ·
`boot()`→`mount()`→`npm install`(~18s)→`server-ready`→iframe 미리보기. Monaco는 jsdelivr이 CORP를
제공해 `require-corp` 아래 정상 로드(자체 호스팅 불필요).

**핵심 결정**: COEP=`require-corp`(§13 결정5) · 싱글턴+`bootPromise` dedup(StrictMode 방어) ·
`retry()`=페이지 새로고침(같은 탭 재부팅 불가).

---

### P1 — 편집/AI 미러링 → HMR + 실제 풀이 화면 (완료 2026-06-24)

**목표**: 학생 편집 / AI 코드 생성 → FS → Vite HMR → 미리보기 갱신 실증 + 실제 학생 풀이 화면 구성.

**(1) 동기화 인프라**

| 파일 | 내용 |
|---|---|
| `src/shared/lib/webcontainer/fileSync.ts` | 경로별 debounce(250ms) FS 동기화기 — 편집·AI 공용 단방향 쓰기 |
| `src/features/solve/useWorkspace.ts` | `files`·`activePath`·`writeFile`·`isPathLocked`·`lockedPaths`·`setActivePath` 확장 |
| `src/features/solve/components/FileTree.tsx` | 파일목록 + 잠금(🔒) 표시 |
| `src/features/solve/components/WorkspaceEditorPanel.tsx` | 파일트리 + Monaco(확장자별 언어·잠금 read-only·AI 작성 중 read-only) |
| `src/features/solve/WorkspacePlaygroundView.tsx` | 2-pane(에디터 ↔ 미리보기) + "AI 미러링 (데모)" 버튼 |

**(2) 실제 풀이 화면 연결 (ChallengeProblem 모델 기반)**

| 파일 | 내용 |
|---|---|
| `src/shared/core/stores/challengeStore.ts` | `despy-challenges`(v1) persist — 과제 CRUD, 샘플 시드 |
| `src/shared/core/constants/sampleChallenges.ts` | 샘플 과제 1개("카운터 초기화 바이브코딩") |
| `src/features/solve/ChallengeSolveView.tsx` | **3열 오케스트레이터**(지문·AI채팅·워크스페이스) |
| `src/features/solve/components/ChallengeStatementPanel.tsx` | 과제 마크다운 지문 패널 |
| `src/app/workspace/[challengeId]/page.tsx` | `/workspace/[id]` 라우트 |
| `src/features/solve/components/AiChatPanel.tsx` | **`problem`→`aiPolicy` prop으로 일반화** (구/신 모델 공용) |
| `src/app/page.tsx` | 홈에 "과제 목록(워크스페이스)" 섹션 추가 |

**연결된 핵심 경로**

```
AI 답변 코드펜스 → AiChatPanel(extractStreamingCodeBlock)
  → onAiCodeStream → workspace.writeFile(activePath) → fileSync(debounce)
  → WebContainer FS → Vite HMR → 미리보기 갱신
학생 직접 편집도 동일 writeFile 경로 (잠금 파일 read-only)
```

**검증 (headless Chrome + CDP, repro2.mjs)**: 데모 버튼 클릭 → 미리보기 텍스트가
`despy 🚀 WebContainer` → `despy 🤖 AI가 작성함 (rev 2)`로 갱신, 콘솔 `[Fast Refresh] rebuilding → done` 확인.
`/workspace/sample-counter-vibe` 3열 화면(지문·AI채팅·에디터·미리보기) 정상 렌더 확인.

**핵심 설계**

- **편집 → FS 단방향**(debounce 250ms): 에디터 버퍼가 단일 출처, FS는 실행본(스펙 §3.3).
- 잠금 파일: Monaco `readOnly` + `writeFile` 가드 이중 차단.
- AI 미러링: 콜백을 `useCallback`로 안정화, 활성 파일 경로는 ref(effect 갱신)로 읽어 콜백 재생성 방지.
- ⚠️ **dev 한계**: 소스를 라이브 편집 중인 탭은 Next Fast Refresh 리마운트로 WebContainer 싱글턴과
  desync될 수 있음 → 하드 리프레시로 해소(실사용자 무관).
- **`despy-workspace` persist 보류**(P4): `ChallengeProblem` 파일 버퍼 영속은 IndexedDB+delta로
  P4에서. 현재 AI 사용량·파일 버퍼는 in-memory.

---

### P2 — 자동 테스트 결과 캡처 (완료 2026-06-24)

**목표**: WebContainer 내 `npm test`(vitest) 실행 → `AutoTestResult` 파싱 → UI 표시.

| 파일 | 내용 |
|---|---|
| `src/shared/lib/webcontainer/testRunner.ts` | `runTests(...)` — vitest JSON reporter 실행·파싱 → `AutoTestResult` |
| `src/shared/core/constants/webcontainerTemplates.ts` | 템플릿에 vitest + @testing-library + happy-dom 의존성, `vitest.config.js`·`vitest.setup.js`·`src/App.test.jsx` 추가 |
| `src/features/solve/useWorkspace.ts` | `runTests()`·`testResult`·`isRunningTests`·`testErrorMessage` 노출 |
| `src/features/solve/components/WorkspacePanel.tsx` | **'테스트' 탭** 추가 → 통과/실패 케이스 표시(ready 상태에서만 실행) |
| `src/features/solve/ChallengeSolveView.tsx` | `onRunTests` 워크스페이스 연결 |
| `src/shared/core/stores/solveSessionStore.test.ts` | (추가 단위 테스트) |

**핵심 설계**: `npm install`이 끝난 `ready` 상태에서만 실행. 테스트 스택은 Vitest + Testing Library +
happy-dom(§3.4, Playwright 불가). 자동 테스트 결과는 **풀이 중 즉시 피드백**이며 공식 점수는 아니다.

---

### P3 — AI 루브릭 채점 (백엔드·데이터 완료, UI 미연결 / 2026-06-24)

**목표**: 제출물·루브릭·자동테스트를 받아 AI 루브릭 정성 채점 + 가중합으로 공식 점수(0~100)를 서버에서 확정.

| 파일 | 내용 |
|---|---|
| `src/shared/lib/grader/grader.ts` | `Grader` 인터페이스 + `RubricGradeInput` — 모델 비의존 계약 |
| `src/shared/lib/grader/geminiGrader.ts` | Gemini `generateObject` + `jsonSchema` 구현 |
| `src/shared/lib/grader/score.ts` | 순수 함수 — `normalizeRubricResult`(클램프·누락 0점) + `computeFinalScore`(가중합) |
| `src/shared/lib/grader/requestValidation.ts` | `validateGradeRequest(unknown)` — 신뢰 경계(필드·weights 합) |
| `src/shared/lib/grader/index.ts` | 채점기 교체점 — `export const grader = geminiGrader` 한 줄 |
| `src/app/api/grade/route.ts` | `/api/grade` — 키 점검 → 검증 → 채점 → 가중합 |
| `src/shared/core/api/gradeApi.ts` · `queries/gradeQueries.ts` | fetch 격리 + `useGradeChallenge` mutation |
| `src/shared/core/types/index.ts` | `ChallengeGradingRequest` — 클라↔라우트 공유 계약 |
| `grader/score.test.ts` · `grader/requestValidation.test.ts` | 정규화·가중합·요청검증 엣지 |

**핵심 설계**

- **점수 무결성은 서버**: LLM 반환 점수를 신뢰하지 않음. 점수 출처는 루브릭 `criteria`, 각 점수를
  `[0, maxScore]`로 클램프·누락 0점·임의 항목 무시. `totalScore`/`maxScore`/`finalScore` 모두 서버 계산.
- **zod 미도입**: `ai`의 `jsonSchema`로 구조화 출력 강제 → 새 의존성 0.
- **신뢰 경계 검증**: `weights` 합 ≠ 1.0이면 400 차단.
- **채점기 추상화**: provider 교체를 `index.ts` 한 줄로(§13 결정3).

**검증**: typecheck·lint·단위 테스트 통과. 실제 Gemini 스모크는 키 인증·요청 형성·스키마 수용까지 OK
(끝-to-끝 1회는 무료티어 분당 쿼터로 보류, 코드 결함 아님).

**남은 P3 (UI 레인)**: `ChallengeSolveView` 제출 버튼 → `useGradeChallenge().mutateAsync(request)`
연결 + 채점 결과 패널. 데이터 계약은 확정됨. (현재 화면엔 "제출·채점은 P2~ 예정" 배지만 있음.)

---

## 현재 타입 상태 (`shared/core/types/index.ts`)

```
ProjectFiles            — WebContainer 파일트리 (Record<string, string>)
RubricCriterion         — 루브릭 항목 (id, description, maxScore)
GradingRubric           — 루브릭 전체 (criteria + weights.tests/rubric)
ChallengeProblem        — 과제 도메인 모델 (template·lockedPaths·editablePaths·
                          setupCommands·devCommand·testCommand·testFiles·rubric·aiPolicy)
AutoTestResult          — 자동 테스트 결과 (passedCount·totalCount·cases)
RubricGradingResult     — AI 루브릭 채점 결과 (scores·totalScore·maxScore·feedback)
ChallengeGradingResult  — 종합 채점 (autoTest + rubric + finalScore)
ChallengeGradingRequest — 채점 요청 계약 (클라 → /api/grade)

-- 구 모델 (P5에서 제거 예정) --
SupportedLanguage, TestCase, AiPolicy, Problem,
TestCaseStatus, TestCaseResult, GradingResult, GradingRequest, AgentUsageMetadata
```

---

## 현재 디렉토리 상태 (피벗 관련 파일)

```
src/
├── app/
│   ├── page.tsx                       — 홈(과제/구 문제 목록)
│   ├── playground/page.tsx            — /playground PoC 라우트 ✅ P0/P1
│   ├── workspace/[challengeId]/page.tsx — /workspace 풀이 라우트 ✅ P1
│   └── api/
│       ├── agent/route.ts             — AI 프록시(Gemini)
│       ├── grade/route.ts             — 공식 채점(루브릭+가중합) ✅ P3
│       └── judge/route.ts             — 구 채점 (P5 제거)
│
├── features/solve/
│   ├── WorkspacePlaygroundView.tsx    — 2-pane PoC ✅ P1
│   ├── ChallengeSolveView.tsx         — 3열 풀이 화면 ✅ P1
│   ├── useWorkspace.ts                — 워크스페이스 훅(편집·runTests) ✅ P1/P2
│   └── components/
│       ├── FileTree.tsx               — 파일트리 UI ✅ P1
│       ├── WorkspaceEditorPanel.tsx   — 파일트리 + Monaco ✅ P1
│       ├── WorkspacePanel.tsx         — 미리보기·콘솔·테스트 탭 ✅ P0/P1/P2
│       ├── ChallengeStatementPanel.tsx — 과제 지문 ✅ P1
│       └── AiChatPanel.tsx            — AI 채팅(aiPolicy 일반화) ✅ P1
│
└── shared/
    ├── lib/webcontainer/
    │   ├── runtime.ts                 — 싱글턴 부트 래퍼 ✅ P0
    │   ├── fileSync.ts                — debounce FS 동기화 ✅ P1
    │   └── testRunner.ts              — npm test 실행·파싱 ✅ P2
    ├── lib/grader/                    — 채점기(인터페이스·Gemini·점수·검증·교체점) ✅ P3
    └── core/
        ├── api/gradeApi.ts            — 채점 fetch 격리 ✅ P3
        ├── queries/gradeQueries.ts    — useGradeChallenge mutation ✅ P3
        ├── stores/challengeStore.ts   — 과제 persist(despy-challenges) ✅ P1
        ├── types/index.ts            — 신규 도메인 타입 전체 ✅
        └── constants/
            ├── webcontainerTemplates.ts — 샘플 템플릿(+vitest) ✅ P0/P1/P2
            └── sampleChallenges.ts    — 샘플 과제 ✅ P1
```

---

## 남은 단계

### P3 (UI 레인) — 제출 → 채점 연결
- `ChallengeSolveView` 제출 버튼 → `useGradeChallenge().mutateAsync(ChallengeGradingRequest)` 호출
- 채점 결과 패널(`ChallengeGradingResult`: 자동테스트 + 루브릭 + finalScore) 렌더
- 제출 시 `testFiles` FS 주입 → `runTests()`로 `AutoTestResult` 수집 후 요청에 첨부

### P4 — 출제 도구 + 워크스페이스 영속
- ✅ `ChallengeAuthorView`(템플릿·잠금경로·테스트·루브릭·AI정책 출제) — 프리셋 + 파일 단위
  편집/추가/잠금 토글(§13 결정4). 새 라우트 `/author/challenge`, 홈에서 진입. challengeStore CRUD
  (`upsertChallenge`/`deleteChallenge`) 사용 — persist 스키마(`despy-challenges` v1) 변경 없음.
  구성: `features/author/ChallengeAuthorView`·`useChallengeDraft`·components/`ChallengeForm`·
  `FileSetEditor`(파일 세트 편집기·잠금 토글)·`RubricEditor`(+ `AiPolicyFields` 재사용).
- ⬜ `despy-workspace` Zustand persist (IndexedDB + delta, §9.1) — 현재 in-memory 버퍼 대체 (미착수)

### P5 — 구 경로 정리
- `/api/judge`·`judgeApi`·`judgeQueries`·`GradingRequest`·`docker-compose.judge0.yml`·
  `docs/judge0.md`·`JUDGE0_*`·`languages.judge0Id` 제거
- `problemStore`(`despy-problems`)·`SolveView`·`ProblemPanel`·`CodeEditorPanel`·`GradingResultPanel` 제거

---

## 작업/커밋 상태 (2026-06-24 스냅샷)

- 브랜치 `develop`, 원격 `hackathon/despy`·`origin/despy`. `hackathon/develop`보다 **2 커밋 앞섬(미푸시)**.
- 커밋됨: P0, P1(`92fcff2`, `b17d55b`). ⚠️ `b17d55b`는 커밋 메시지가 비정상(설명문 유입) — 미푸시라 amend로 정정 가능.
- 미커밋(working tree): **P2 + P3** 작업 일체(`grader/`·`/api/grade`·`testRunner`·`gradeApi`·`gradeQueries`·
  WorkspacePanel/useWorkspace/template/types 변경).

---

## 검증 스크립트

P0/P1 검증용 headless Chrome + CDP 스크립트는 세션 scratchpad에 위치(`repro2.mjs` 등).
재검증 시 `npm run dev` 후 시스템 Chrome(`puppeteer-core`, `executablePath`)로 `/playground`·`/workspace/[id]`
로드 → 데모 버튼/편집 → 미리보기 프레임(`webcontainer-api.io`) 텍스트 변화 확인.
