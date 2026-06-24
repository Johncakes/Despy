# despy P3 인수인계 — AI 루브릭 채점 (제출→채점→결과)

> **상태: P3 백엔드 구현 완료(미커밋) · 프론트 연결 잔여**
> WebContainer 피벗 로드맵(`docs/spec-webcontainer.md` §12)의 **P3** 단계 현황과 잔여 작업·착수
> 프롬프트를 정리한 문서다. 목표: `/api/grade` + 가중합으로 `ChallengeGradingResult` 최종 점수 산출
> 및 학생 화면 표시.

> 문서 지도
> - [`docs/spec-webcontainer.md`](./spec-webcontainer.md) — 피벗 전체 명세(§6 학생 플로우·§7.2 `/api/grade`·§13 결정3·6)
> - [`CLAUDE.md`](../CLAUDE.md) — 레이어 규칙·컨벤션·의사결정 체크포인트

---

## 1. 현재 상태 (P0·P1·P2 완료·검증됨)

| 단계 | 내용 | 상태 |
|---|---|---|
| P0 | WebContainer 부팅 + 미리보기(COOP/COEP) | ✅ 검증됨 |
| P1 | Monaco ↔ FS 동기화 + AI 미러링(편집→HMR) | ✅ 검증됨 |
| P2 | `npm test`(Vitest) 결과 캡처 → `AutoTestResult` 파싱·표시 | ✅ 검증됨 (headless Chrome로 `/playground`에서 `2/2 통과` 실측) |

P2 산출물: [`testRunner.ts`](../src/shared/lib/webcontainer/testRunner.ts)(JSON 리포터 파싱),
[`runtime.ts`](../src/shared/lib/webcontainer/runtime.ts)의 `runCommandWithTimeout`(타임아웃 가드),
[`WorkspacePanel.tsx`](../src/features/solve/components/WorkspacePanel.tsx)의 '테스트' 탭,
[`webcontainerTemplates.ts`](../src/shared/core/constants/webcontainerTemplates.ts)의 Vitest+Testing Library+happy-dom 스택.

---

## 2. ⚠️ 핵심: P3 백엔드는 이미 워킹트리에 구현되어 있음 (untracked, 미커밋)

아래 파일들은 **이미 존재하고 이번 세션의 `typecheck`·`lint`·단위테스트를 통과**한다.
**다시 만들지 말고 먼저 읽어 계약을 파악한 뒤 재사용**한다.

| 파일 | 역할 | 비고 |
|---|---|---|
| [`shared/lib/grader/grader.ts`](../src/shared/lib/grader/grader.ts) | 채점기 인터페이스 | 결정3 — 후일 Claude 교체를 1파일로 |
| [`shared/lib/grader/geminiGrader.ts`](../src/shared/lib/grader/geminiGrader.ts) | Gemini 구현(루브릭 정성 채점) | structured output 방식(zod 미설치 — jsonSchema 여부 코드 확인) |
| [`shared/lib/grader/score.ts`](../src/shared/lib/grader/score.ts) | 자동테스트 통과율 + 루브릭 점수 가중합(`computeFinalScore`) | 단위테스트 `score.test.ts` 통과 |
| [`shared/lib/grader/requestValidation.ts`](../src/shared/lib/grader/requestValidation.ts) | `ChallengeGradingRequest` 요청 검증 | 단위테스트 `requestValidation.test.ts` 통과 |
| [`shared/lib/grader/index.ts`](../src/shared/lib/grader/index.ts) | `grader` 싱글턴 export(교체점) | |
| [`app/api/grade/route.ts`](../src/app/api/grade/route.ts) | 공식 채점 라우트 | `grader.gradeRubric` + `computeFinalScore` → `ChallengeGradingResult`. 요청 검증은 `requestValidation.ts`로 분리 |
| [`shared/core/api/gradeApi.ts`](../src/shared/core/api/gradeApi.ts) | `gradeChallenge` fetch | 채점 fetch 격리 |
| [`shared/core/queries/gradeQueries.ts`](../src/shared/core/queries/gradeQueries.ts) | `useGradeChallenge` mutation | `mutateAsync(request) → ChallengeGradingResult` |
| [`shared/core/types/index.ts`](../src/shared/core/types/index.ts) | `ChallengeGradingRequest`/`ChallengeGradingResult`/`RubricGradingResult` 타입 | |

**무결성(§7.2)**: 요청의 `autoTest`는 풀이 중 클라이언트가 본 *즉시 피드백*일 뿐이다. 루브릭 채점은
서버가 확정하며, **서버측 테스트 재실행(샌드박스)은 §7.2대로 P3 이후 별도 단계로 미룬다**. 현재 P3는
클라이언트 `autoTest`를 참고 신호로 받아 가중합한다.

---

## 3. P3 잔여 작업 (= 학생 제출 → 채점 → 결과 표시 연결)

현재 `useGradeChallenge` **호출처가 0개**다. [`ChallengeSolveView`](../src/features/solve/ChallengeSolveView.tsx)는
아직 제출 플로우가 없고 상단 배지가 "제출·채점은 P2~ 예정"으로 남아 있다.

1. **제출 액션** — `ChallengeSolveView`에 '제출' 버튼 + `useGradeChallenge` 연결(로딩/에러 처리).
   - 제출 페이로드(`ChallengeGradingRequest`): `submittedFiles`(=`workspace.files`, 또는 `lockedPaths` 제외분)
     · `rubric` · `statement` · `aiPolicy`의 `model`/`systemPrompt` · **P2 자동테스트 결과(`workspace.testResult`)**.
   - `testResult`가 없으면 제출 전에 `workspace.runTests()`를 먼저 돌릴지 결정.
   - 실제 요청 필드는 `route.ts`의 `validate()`와 `ChallengeGradingRequest` 타입에서 정확히 확인해 맞춘다.
2. **`ChallengeGradingResultPanel` (신규)** — `features/solve/components/`에 작성.
   - 표시: `finalScore`(0~100) · `autoTest` 요약(passed/total) · `rubric.scores`(criterionId별 점수·이유) · `feedback`.
   - 구 [`GradingResultPanel.tsx`](../src/features/solve/components/GradingResultPanel.tsx)는 알고리즘 표준입출력용이므로 **재사용하지 않고 별도 작성**.
3. **레이아웃 연결** — 제출 버튼 위치 + 결과 패널 배치(아래 §4 Blocking).

---

## 4. 의사결정 체크포인트 (코드 작성 전 멈추고 확인)

| 항목 | 분류 | 메모 |
|---|---|---|
| 결과 표시 위치/방식 (워크스페이스 탭 추가 vs 오버레이/모달 vs 별도 열) | **Blocking** (UX 변경) | 선택지·장단점 제시 후 승인 |
| 제출 페이로드 파일 범위 (전체 `files` vs 변경 파일만) | Inform | 근거와 함께 선택 |
| structured output에 `zod` 등 새 의존성 필요 시 | **Blocking** (새 라이브러리) | 현재 `zod` 미설치 · `ai ^6.0.209` · `@ai-sdk/google ^3.0.83` |
| `testResult` 없을 때 제출 전 자동 테스트 강제 실행 여부 | Inform | UX·시간 트레이드오프 |

---

## 5. 검증 방법

- `GEMINI_API_KEY`가 `.env.local`에 있으면 제출 E2E 실측. 없으면 `grader.isAvailable()` false →
  라우트 500 응답 동작 확인.
- 가능하면 headless Chrome + CDP로 `/workspace/[challengeId]`에서 제출→결과 표시까지 확인(P2 검증 방식 재사용).
- 완료 체크리스트: `npm run typecheck` · `npm run lint` · `npm run test` 통과 / 변경 시
  `CLAUDE.md`(디렉토리·queryKeys·persist)·`spec-webcontainer.md` P3 로드맵 행 동기화.

---

## 6. 착수 프롬프트 (새 세션 복사용)

```text
despy 프로젝트 WebContainer 피벗 P3 작업을 이어서 합니다.
먼저 CLAUDE.md와 docs/spec-webcontainer.md(§6 학생 플로우·§7.2 /api/grade·§13 결정3·6),
그리고 docs/p3-handoff.md를 읽어주세요.

## ⚠️ 중요: P3 백엔드는 이미 워킹트리에 untracked로 구현되어 typecheck·lint·단위테스트를
##         통과합니다. 다시 만들지 말고 먼저 읽어 계약을 파악한 뒤 재사용하세요.
- src/shared/lib/grader/ (grader.ts·geminiGrader.ts·score.ts·requestValidation.ts·index.ts; 단위테스트 통과)
- src/app/api/grade/route.ts (grader.gradeRubric + computeFinalScore → ChallengeGradingResult)
- src/shared/core/api/gradeApi.ts (gradeChallenge) + src/shared/core/queries/gradeQueries.ts (useGradeChallenge)
- src/shared/core/types/index.ts (ChallengeGradingRequest/Result/RubricGradingResult)
- geminiGrader의 structured output 방식(zod 미설치)과 route의 validate() 요구 필드를 코드에서 확인 후 페이로드를 맞추세요.

## P3 잔여 작업 (제출 → 채점 → 결과 표시 연결)
1. ChallengeSolveView에 '제출' 액션 추가: useGradeChallenge.mutateAsync 호출(로딩/에러),
   상단 "제출·채점은 P2~ 예정" 배지 대체. 페이로드=submittedFiles(workspace.files)·rubric·statement·
   aiPolicy(model/systemPrompt)·자동테스트 결과(workspace.testResult; 없으면 runTests 선실행 검토).
2. ChallengeGradingResultPanel(신규): finalScore·autoTest 요약·rubric.scores(항목별 점수/이유)·feedback.
   구 GradingResultPanel.tsx는 재사용 말고 별도 작성.
3. 결과 패널 배치·제출 버튼 위치는 UX 변경이므로 코드 전에 선택지 제시 후 승인(Blocking).

## 의사결정 체크포인트(코드 전 확인)
- 결과 표시 위치/방식 — Blocking(UX)
- 제출 파일 범위(전체 vs 변경분) — 근거 제시
- structured output에 새 의존성(zod 등) 필요 시 — Blocking(새 라이브러리)

## 검증·완료 체크리스트
- GEMINI_API_KEY 있으면 제출 E2E 실측, 없으면 500 동작 확인. 가능하면 headless Chrome로 제출→결과 표시 확인.
- npm run typecheck / lint / test 통과 · CLAUDE.md·spec P3 행 동기화.

작업 시작 전에 위 untracked 백엔드 파일을 먼저 읽고, 파악한 계약과 잔여 작업 계획을 요약해 주세요.
```
