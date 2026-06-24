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
| **P3** | AI 루브릭 채점 + 가중합 | ✅ 완료 (백엔드·데이터 + 제출 UI 연결·결과 모달) |
| **P4** | 출제 도구 + 제출 플로우 + 워크스페이스 persist | ✅ 완료 (출제 도구 ✅ / 워크스페이스 영속 `despy-workspace` IndexedDB+델타 ✅·실측) |
| **P5** | 구 Judge0 채점 제거 → **AI 채점으로 교체** | ✅ 완료 (알고리즘 경로는 유지) |

**핵심 방향 변경(2026-06-24)**: 백엔드 최소화 원칙 **해제**. 채점 무결성을 위해 공식 점수는
서버(`/api/grade`)가 확정한다(§13 결정6). 채점 무결성 = (b) 서버 재실행 하이브리드 채택.

**P5 방향 변경(2026-06-24)**: 당초 P5는 "구 Judge0/Problem 경로 **제거**"였으나, 알고리즘 코테
기능은 살리되 채점만 AI로 바꾸기로 결정. **Judge0 실행 계층만 제거**하고(`/api/judge`·`judgeApi`·
`judgeQueries`·`docker-compose.judge0.yml`·`docs/judge0.md`·`JUDGE0_*`·`judge0Id`/`judge0LanguageId`/
`isMock`), 알고리즘 채점은 **AI 정성 판정**(`/api/grade/algorithm`)으로 교체했다. `Problem`/
`problemStore`/`SolveView`/구 author는 모두 **유지**. 트레이드오프: AI는 코드를 실행하지 않고
추론하므로 정답성·엣지·TLE 판정이 근사다(무결성 한계는 UI에 명시).

**빌드 상태**: `npm run typecheck` ✅ · `npm run lint`(레이어 규칙 포함) ✅ · `npm run test` ✅ (6파일 60테스트).

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

### P4 — 워크스페이스 영속 (완료 2026-06-24)

**목표**: in-memory였던 학생 파일 버퍼·AI 사용량(질문/토큰)을 새로고침 후에도 과제별로 유지(§9.1).

| 파일 | 내용 |
|---|---|
| `src/shared/core/stores/idbStorage.ts` | 네이티브 IndexedDB `StateStorage` 어댑터(단일 objectStore) — **새 의존성 0**. SSR/jsdom 가드 |
| `src/shared/core/stores/workspaceStore.ts` | `despy-workspace`(v1) persist — 과제별 `{ fileDelta, activePath, questionsUsed, tokensUsed }`. `createJSONStorage(idbStorage)` + `hasHydrated` 플래그 |
| `src/features/solve/useWorkspace.ts` | `challengeId` 인자 추가 → boot 시 델타 복원(`{...template, ...delta}` mount)·편집 debounce(400ms) 영속·`setActivePath`/`recordAiTurn` 영속·언마운트 flush. boot를 `hasHydrated` 뒤로 게이트 |
| `src/features/solve/ChallengeSolveView.tsx` | AI 사용량을 in-memory state → `workspace.{questionsUsed,tokensUsed,recordAiTurn}`(영속)로 전환 |
| `src/shared/core/stores/workspaceStore.test.ts` | 델타 저장·활성파일·AI 누적·격리·초기화 단위 테스트(jsdom은 IndexedDB 미구현 → in-memory degrade) |

**핵심 설계 (Blocking 결정)**

- **IndexedDB 접근 = 네이티브 어댑터**(idb 라이브러리 미도입) — P3의 "새 의존성 0" 기조 유지.
- **저장 경계 = 단일 store**(`despy-workspace`, IndexedDB)에 파일 델타 + 활성파일 + AI 사용량 전부(§9.1 표 일치).
- **델타만 저장**: 잠금 제외, 템플릿과 다른 파일만(`computeFileDelta`). 복원 시 template과 병합 → quota 절약.
- **비동기 hydration 게이트**: IndexedDB rehydrate는 비동기 → `hasHydrated`로 boot(mount)를 복원 이후로 미뤄 저장 편집분이 미리보기에 반영. (localStorage 동기 store와의 차이 — CLAUDE.md persist 규칙에 명시)
- **migrate 불필요**: `despy-workspace`는 신규 키(클린 슬레이트, §9.1·결정1) → v1 시작.
- **PoC 호환**: `challengeId` 미지정(WorkspacePlaygroundView)이면 영속 건너뜀(in-memory 유지).

**검증**: typecheck·lint·test(6파일 51테스트) 통과. **실측**(headless Chrome, `/workspace/sample-counter-vibe`):
편집 → IndexedDB(`despy` > `keyval` > `despy-workspace`) `fileDelta`에 마커 저장 확인 → 새 페이지 재로드 →
복원된 에디터에 마커 유지 확인(편집→영속, 새로고침 복원 모두 PASS).

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

-- 알고리즘 모델 (유지 — AI 채점) --
SupportedLanguage(judge0Id 제거됨), TestCase, Problem,
TestCaseStatus, TestCaseResult(reason? 추가), GradingResult(feedback 추가·isMock 제거),
GradingRequest(statement/model 추가·judge0LanguageId 제거 → /api/grade/algorithm)
-- 공용 --
AiPolicy, AgentUsageMetadata
```

---

## 현재 디렉토리 상태 (피벗 관련 파일)

```
src/
├── app/
│   ├── page.tsx                       — 홈(과제/알고리즘 문제 목록)
│   ├── playground/page.tsx            — /playground PoC 라우트 ✅ P0/P1
│   ├── workspace/[challengeId]/page.tsx — /workspace 풀이 라우트 ✅ P1
│   └── api/
│       ├── agent/route.ts             — AI 프록시(Gemini)
│       ├── grade/route.ts             — 과제 공식 채점(루브릭+가중합) ✅ P3
│       └── grade/algorithm/route.ts   — 알고리즘 공식 채점(AI 정성 판정) ✅ P5 (judge 대체)
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
        ├── stores/workspaceStore.ts   — 풀이 영속 persist(despy-workspace, IndexedDB+델타) ✅ P4
        ├── stores/idbStorage.ts       — IndexedDB StateStorage 어댑터(네이티브) ✅ P4
        ├── stores/submissionStore.ts  — 제출 채점결과 persist(despy-submissions, localStorage) — 대시보드 소스 ✅
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
- ✅ 채점 대시보드 — `GradingDashboardView` + 라우트
  `/author/challenge/[challengeId]/submissions`(출제 편집 패널의 '채점 현황 →' 링크로 진입).
  루브릭·AI정책 요약 + **학생 제출 목록**(이름·시각·점수, 최신순 / 펼치면 루브릭 항목별 점수·피드백)을
  표시한다. 데이터 소스는 신규 `submissionStore`(`despy-submissions`, localStorage) — 학생이 제출해
  채점 성공 시 `ChallengeSolveView`가 결과를 입력한 이름/별명과 함께 저장한다(②→③ 고리 연결).
  ⚠️ MVP 한계: 인증·서버 집계 없음 → 이 브라우저에서 이뤄진 제출만, 식별은 입력 이름에 의존.
  검증: 단위테스트(submissionStore) + headless Chrome로 제출 시드→대시보드 렌더(이름·점수·최신순·
  루브릭·피드백) 8/8 PASS.
- ✅ `despy-workspace` Zustand persist (IndexedDB + delta, §9.1) — in-memory 버퍼·AI 사용량 대체.
  `idbStorage`(네이티브 어댑터) + `workspaceStore`(델타) + `useWorkspace`(복원/저장·hasHydrated 게이트)
  + `ChallengeSolveView`(AI 사용량 영속화). headless Chrome로 편집→IDB 저장→새로고침 복원 실측 PASS.

### P5 — Judge0 채점 제거 → AI 채점 교체 (완료 2026-06-24)
- ✅ **제거(Judge0 실행 계층만)**: `/api/judge`·`judgeApi`·`judgeQueries`·
  `docker-compose.judge0.yml`·`docs/judge0.md`·`JUDGE0_*` env·`SupportedLanguage.judge0Id`·
  `GradingRequest.judge0LanguageId`·`GradingResult.isMock`.
- ✅ **교체(AI 알고리즘 채점)**: `grader` 인터페이스에 `gradeAlgorithm` 추가 →
  `geminiGrader`(구조화 출력으로 케이스별 통과/실패·근거 판정, `INJECTION_GUARD` 재사용) ·
  `score.normalizeAlgorithmResult`(케이스 정규화·비공개 가림·통과수 집계) ·
  `requestValidation.validateAlgorithmRequest`. 라우트 `POST /api/grade/algorithm`.
  클라: `algorithmGradeApi`+`algorithmGradeQueries`(`useGradeAlgorithm`) → SolveView 재배선.
  `GradingResultPanel`은 "AI 채점(실행 아님)" 배너 + 케이스별 근거 + 종합 피드백 표시.
- ✅ **유지**: `Problem`·`problemStore`(`despy-problems`)·`SolveView`·`ProblemPanel`·
  `CodeEditorPanel`·구 author 전체. 알고리즘 코테 기능은 살아 있고 채점만 AI로 바뀜.
- 트레이드오프(결정): 정확한 실행 채점 vs 다언어 vs Judge0 제거의 트릴레마에서 **AI 채점**(다언어
  유지·Judge0 제거) 선택. AI는 코드를 실행하지 않고 추론하므로 정답성·엣지·TLE 판정이 근사다.

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
