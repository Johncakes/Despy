# 구현 진행 기록 — WebContainer 피벗

> 이 문서는 WebContainer 피벗(P0~) 구현 이력을 대화 간 맥락 인계용으로 정리한 것이다.
> 전체 명세는 [spec-webcontainer.md](./spec-webcontainer.md), AI 지도는 [CLAUDE.md](../CLAUDE.md).

---

## 완료 단계

### P0 — WebContainer PoC (완료 2026-06-24)

**목표**: WebContainer가 브라우저에서 실제로 부팅·미리보기되는지 검증.

**구현 파일**

| 파일 | 내용 |
|---|---|
| `next.config.ts` | COOP(`same-origin`) + COEP(`require-corp`) 헤더 전역 주입 |
| `src/shared/core/types/index.ts` | `ProjectFiles` 타입 추가 (+ 이후 P1에서 `ChallengeProblem` 등 전체 신규 타입 추가 — 사용자 직접 작성) |
| `src/shared/lib/webcontainer/runtime.ts` | WebContainer 싱글턴 부트 래퍼 신규 |
| `src/shared/core/constants/webcontainerTemplates.ts` | `VITE_REACT_SAMPLE_TEMPLATE` + `VITE_REACT_SAMPLE_LOCKED_PATHS` 신규 |
| `src/features/solve/useWorkspace.ts` | 워크스페이스 훅 초기 버전 신규 (phase/logs/previewUrl) |
| `src/features/solve/components/WorkspacePanel.tsx` | 미리보기 iframe + 콘솔 패널 신규 |
| `src/features/solve/WorkspacePlaygroundView.tsx` | `/playground` PoC 뷰 신규 |
| `src/app/playground/page.tsx` | `/playground` 라우트 신규 |
| `src/app/page.tsx` | "WebContainer PoC →" 링크 추가 |

**검증 (headless Chrome + CDP)**

- 모든 응답에 COOP/COEP 헤더 확인
- `window.crossOriginIsolated === true`
- `boot()` → `mount()` → `npm install`(~18s) → `server-ready` → iframe 미리보기 URL 표시
- Monaco CDN(jsdelivr)이 CORP 헤더를 제공해 `require-corp` 아래 정상 로드됨 → 자체 호스팅 불필요

**핵심 결정**

- COEP 모드: `require-corp` (§13 결정5). Monaco × COEP 충돌 없음(jsdelivr CORP 제공).
- WebContainer 싱글턴 + `bootPromise` dedup 가드 — React StrictMode 이펙트 2회 실행 방어.
- `retry()` = `window.location.reload()` — 같은 탭 재부팅 불가.

---

### P1 — Monaco ↔ FS 동기화 + AI 미러링 경로 (완료 2026-06-24)

**목표**: 학생 편집 / AI 코드 생성 → FS → Vite HMR → 미리보기 갱신 실증.

**추가/변경 파일**

| 파일 | 내용 |
|---|---|
| `src/shared/lib/webcontainer/fileSync.ts` | 경로별 debounce FS 동기화기 신규 |
| `src/features/solve/useWorkspace.ts` | `files`, `activePath`, `writeFile`, `isPathLocked`, `lockedPaths`, `setActivePath` 확장 |
| `src/features/solve/components/FileTree.tsx` | 파일목록 + 잠금(🔒) 표시 신규 |
| `src/features/solve/components/WorkspaceEditorPanel.tsx` | 파일트리 + Monaco(확장자별 언어, 잠금 시 read-only) 신규 |
| `src/features/solve/WorkspacePlaygroundView.tsx` | 2-pane(에디터 ↔ 미리보기) 재구성 + "AI 미러링 (데모)" 버튼 |
| `src/shared/core/constants/webcontainerTemplates.ts` | `VITE_REACT_SAMPLE_LOCKED_PATHS` 추가 |

**검증 (headless Chrome + CDP)**

```
# verify-hmr.mjs 스크립트 실행 결과
[48s] ✅ 미리보기 ready
데모 버튼: CLICKED
✅ HMR 확인 — Vite가 변경을 감지하고 미리보기를 갱신함:
   오후 5:27:53 [vite] hmr update /src/App.jsx
```

- Monaco 모델 확인: `<h1>despy 🚀 WebContainer</h1>` → `<h1>despy 🤖 AI가 작성함 (rev 1)</h1>`
- AI 미러링 데모(= `writeFile`)와 학생 직접 편집이 동일 경로(debounce → `fs.writeFile` → HMR)를 타므로 양쪽 모두 검증됨

**핵심 설계**

- **편집 → FS 단방향**(debounce 250ms): 에디터 버퍼가 단일 출처, FS는 실행본(스펙 §3.3).
- 잠금 파일: Monaco `readOnly` + `writeFile` 가드 이중 차단.
- `fileSyncRef.current = createFileSync()` — 훅 생애주기 동안 1개 인스턴스, 언마운트 시 `cancel()`.
- **실제 `AiChatPanel` 연결 보류**: 구 `Problem` 모델에 묶여 있어 연결은 P4(새 solve 플로우)로.
- **`despy-workspace` persist 보류**: `ChallengeProblem` 스키마 확정 전(P4). 현재 in-memory.

---

## 현재 타입 상태 (`shared/core/types/index.ts`)

사용자가 직접 전체 타입을 재작성했다. 아래가 현재 정의된 타입 목록:

```
ProjectFiles           — WebContainer 파일트리 (Record<string, string>)
RubricCriterion        — 루브릭 항목 (id, description, maxScore)
GradingRubric          — 루브릭 전체 (criteria + weights.tests/rubric)
ChallengeProblem       — 과제 도메인 모델 (template, lockedPaths, editablePaths,
                         setupCommands, devCommand, testCommand, testFiles, rubric, aiPolicy)
AutoTestResult         — 자동 테스트 결과 (passedCount, totalCount, cases)
RubricGradingResult    — AI 루브릭 채점 결과 (scores, totalScore, maxScore, feedback)
ChallengeGradingResult — 종합 채점 (autoTest + rubric + finalScore)

-- 구 모델 (P5에서 제거 예정) --
SupportedLanguage, TestCase, AiPolicy, Problem,
TestCaseStatus, TestCaseResult, GradingResult, GradingRequest,
AgentUsageMetadata
```

---

## 현재 디렉토리 상태 (피벗 관련 파일)

```
src/
├── app/
│   ├── playground/page.tsx          — /playground 라우트 ✅ P0
│   └── api/judge/route.ts           — 구 채점 (P5에서 제거)
│
├── features/solve/
│   ├── WorkspacePlaygroundView.tsx  — 2-pane PoC ✅ P1
│   ├── useWorkspace.ts              — 워크스페이스 훅 ✅ P1
│   └── components/
│       ├── FileTree.tsx             — 파일트리 UI ✅ P1
│       ├── WorkspaceEditorPanel.tsx — 파일트리 + Monaco ✅ P1
│       └── WorkspacePanel.tsx       — 미리보기 + 콘솔 ✅ P0/P1
│
└── shared/
    ├── lib/webcontainer/
    │   ├── runtime.ts               — 싱글턴 부트 래퍼 ✅ P0
    │   └── fileSync.ts              — debounce FS 동기화 ✅ P1
    └── core/
        ├── types/index.ts           — 신규 도메인 타입 전체 ✅ P1(사용자)
        └── constants/
            └── webcontainerTemplates.ts  — 샘플 템플릿 ✅ P0/P1
```

---

## 다음 단계

### P2 — 자동 테스트 결과 캡처

**목표**: WebContainer 내 `npm test` 실행 → `AutoTestResult` 파싱 → UI 표시.

**구현 예정 파일**

| 파일 | 내용 |
|---|---|
| `src/shared/lib/webcontainer/testRunner.ts` | `runTests(command, args, onOutput?): Promise<AutoTestResult>` — vitest JSON reporter 파싱 |
| `webcontainerTemplates.ts` | 샘플 템플릿에 vitest + `src/App.test.jsx` 추가, package.json에 vitest 의존성 추가 |
| `useWorkspace.ts` | `runTests(): Promise<AutoTestResult>` 노출 |
| `WorkspacePanel.tsx` | '테스트' 탭 추가 → `AutoTestResult` 결과 표시 |

**주의**: `AutoTestResult` 타입은 이미 `types/index.ts`에 정의되어 있음.

---

### P3 — AI 루브릭 채점

`/api/grade` 신규 라우트. Gemini 구조화 출력(`generateObject`)으로 `RubricGradingResult` → `finalScore` 가중합.

### P4 — 출제 도구 + 풀이 연결

- `ChallengeAuthorView` (템플릿·잠금·테스트·루브릭 출제)
- 실제 `AiChatPanel` → `writeFile` 연결 (구 `Problem` 모델 제거 후)
- `despy-workspace` Zustand persist (IndexedDB + delta, §9.1)

### P5 — 정리

- `/api/judge`, `judgeApi`, `judgeQueries`, `GradingRequest`, `docker-compose.judge0.yml`, `docs/judge0.md`, `JUDGE0_*` 환경변수, `languages.judge0Id` 제거
- `problemStore`(`despy-problems` key) 제거

---

## 검증 스크립트 위치

P0/P1 검증에 사용한 headless Chrome + CDP 스크립트:

```
/private/tmp/claude-501/.../scratchpad/verify-hmr.mjs   — HMR 자동 검증
```

재검증이 필요하면 `npm run dev` 실행 후 headless Chrome(`--remote-debugging-port=9222`)을 띄우고 스크립트를 실행한다.
