# despy 명세서 — ML 챌린지 (TensorFlow.js 기반)

> **상태: 구현 완료 (2026-06-25)** — Blocking 결정 확정(§8): 데이터 모델은 `kind` 확장, 범위는
> **분류(정확도) + 회귀(RMSE) 둘 다**, 성능 점수는 **브라우저 컨테이너 계산**(서버 재실행은 후속).
> TF.js는 pure `@tensorflow/tfjs`로 확정(tfjs-node는 WebContainer 네이티브 바인딩 미지원으로 불가).
> despy에 "ML 과제/챌린지"를 추가하기 위한 계획서.
> 학생이 통제된 AI 에이전트를 활용해 **브라우저 안에서 ML 모델을 만들고**, 숨긴 테스트셋
> 성능(객관 점수) + AI 활용 과정(Gemini 정성 채점)으로 평가받는다.

> 문서 지도
> - [`CLAUDE.md`](../CLAUDE.md) — 프로젝트 지도(레이어 규칙·컨벤션)
> - [`docs/spec-webcontainer.md`](./spec-webcontainer.md) — 워크스페이스 피벗 명세(이 기능의 토대)
> - [`docs/spec-grading.md`](./spec-grading.md) — 채점 구조(재활용 대상)
> - **이 문서** — ML 챌린지 추가 계획

---

## 1. 배경과 결론

ML 채용·교육 현장 조사 결과(2026-06-25):

- ML은 "라이브 코테"보다 **"데이터셋 과제 + 지표 채점"** 이 표준 — nbgrader(대학),
  Kaggle public/private holdout(대회), 기업 테이크홈 과제 모두 이 형식.
- 채점은 **숨긴 테스트셋에 대한 예측 성능(정확도/RMSE)** → despy의 "객관 수치 채점" 원칙과 일치.
- ⚠️ **결정적 제약**: despy의 WebContainer는 pip 미지원이라 Python ML(numpy/sklearn) 불가.
  Pyodide는 172MB + 멀티파일 문제로 마찰 큼. → **TensorFlow.js(JS 네이티브 ML)** 만 현재 스택과 마찰 없음.
- despy 차별점: 단순 점수 채점은 Kaggle이 이미 함. despy 고유 가치는
  **"제한된 AI 자원으로 ML 문제를 푸는 과정"을 정성 평가**하는 것(MLE-bench류 트렌드와 정합).

**결론: TensorFlow.js 기반 ML 챌린지 + holdout 지표 자동 채점 + AI 활용 정성 채점.**

---

## 2. 목표 / 비목표

### 목표 (MVP / 해커톤 데모)
- 분류 문제 1종(예: Iris·MNIST 서브셋)이 **end-to-end** 동작:
  데이터 제공 → TF.js 모델 작성(AI 도움) → 제출 → 숨긴 테스트셋 정확도 + 정성 채점.
- 기존 챌린지(워크스페이스) 인프라 **최대 재활용** — 새 스토어·새 백엔드 서비스 최소화.

### 비목표 (이번 범위 밖)
- Python ML(numpy/sklearn) 실행 — Pyodide/서버 Docker 도입은 별도 논의(Blocking, §8).
- 회귀·다중 데이터셋·리더보드 순위 — 점수 채점 골격이 서면 후속 확장.
- 학생 부정행위(데이터 누수) 자동 탐지 — §7에 한계만 명시.

---

## 3. 사용자 흐름

```
[교수] ML 챌린지 출제
   문제 지문 + train 데이터 + 숨긴 test 데이터 + 평가지표/합격 임계값 + AI 정책 + 루브릭

[학생] 워크스페이스에서 풀이
   train.csv·시작 코드 받음 → AI 채팅(토큰 제한)으로 TF.js 모델 작성
   → 컨테이너에서 학습/검증 반복 → 학습 곡선 실시간 확인(기존 stdout 센티넬 재활용)

[제출] 채점
   ① 객관: 컨테이너에 숨긴 test 주입 → 정확도 계산 → stdout으로 회수 (seed 고정)
   ② 정성: Gemini가 제출 코드(model.mjs·train.mjs)로 "AI 활용" 루브릭 채점
   → 성능 점수 + 정성 점수 + 합격 여부 표시
```

---

## 4. 데이터 모델 (제안)

기존 `ChallengeProblem`에 **판별자(`kind`)** 를 추가하고, ML 전용 필드는 선택 필드로 얹는다.
(별도 store/타입 분리 대신 확장 — 워크스페이스·제출·AI 채팅 인프라를 그대로 재활용하기 위함.)

```ts
// shared/core/types/index.ts (추가 제안)

export type ChallengeKind = 'workspace' | 'ml';

export interface MlSpec {
  /** 평가지표 — MVP는 분류 정확도만 */
  metric: 'accuracy'; // 후속: 'rmse' | 'f1' ...
  /** 합격 임계값 (예: 0.8 = 정확도 80%) */
  passThreshold: number;
  /** 재현성을 위한 고정 seed (점수 변동성 제거) */
  seed: number;
  /** 학생 노출 train 데이터 경로(템플릿 파일트리 내) */
  trainDataPath: string;  // 예: 'data/train.csv'
  /** 채점 시점에만 주입하는 숨긴 test 데이터 경로 */
  testDataPath: string;   // 예: 'data/test.csv' (testFiles에 포함)
  /** 학생이 구현해야 하는 평가 진입점 (점수 stdout 출력 규약) */
  evalCommand: string;    // 예: 'node eval.mjs'
}

export interface ChallengeProblem {
  // ...기존 필드 그대로...
  kind: ChallengeKind;       // 신규 (기존 데이터는 'workspace'로 migrate)
  ml?: MlSpec;               // kind === 'ml'일 때만
}
```

> **점수 출력 규약**: 평가 스크립트는 약속된 센티넬로 정확도를 stdout에 출력한다.
> 예: `__DESPY_SCORE__{"metric":"accuracy","value":0.873}` →
> 기존 WebContainer stdout 센티넬 파이프라인(`runtime.ts`)이 파싱.

---

## 5. 채점 (2축)

| 축 | 무엇을 | 어떻게 | 재활용 |
|---|---|---|---|
| **① 성능 (객관)** | 숨긴 test 정확도 ≥ 임계값 | 제출 시 `testFiles` 주입 → `evalCommand` 실행 → 센티넬로 점수 회수 → 임계값 비교 | `runtime.ts` 센티넬, `testFiles` 주입 |
| **② AI 활용 (정성)** | 제한된 AI를 어떻게 부렸나 | Gemini가 제출 코드로 루브릭 채점 (대화 기록은 미전달 — 아래 §5a) | `geminiGrader.ts`, `GradingRubric` |

- **성능 점수는 클라이언트가 아니라 컨테이너 실행 결과**에서만 나온다(학생이 조작 불가한 숨긴 test).
- **seed 고정** 필수 — 동일 코드의 점수 변동(double-digit 편차 보고됨)을 제거해 공정성 확보.

---

## 5a. 정성 채점 범위 — 코드 전용 (확정, 2026-06-25)

**현재 채점 API(`/api/grade`)는 대화 기록을 채점기에 전달하지 않는다.**
요청 페이로드는 `submittedFiles`(제출 코드)·`autoTest`·`rubric`·`mlScore`·`statement`만 포함하며,
학생-AI 대화 트랜스크립트(`prompts`)는 `submissionStore`에 저장되지만 채점 경로로 흘러가지 않는다.

따라서 ML 루브릭 기준의 채점 근거는 **코드에서만 추론**해야 한다:

| 기준 | 근거로 쓰이는 것 |
|---|---|
| `ai-guided-modeling` | `model.mjs`의 레이어 구조·하이퍼파라미터 선택이 문제 맥락에 맞는지 |
| `iteration-evidence` | `buildModel`·`TRAIN_CONFIG`가 기본값에서 성능을 의식해 수정되었는지 |

**이 결정을 유지하는 이유:**
- 대화 기록을 채점 프롬프트에 포함하면 토큰 비용이 크게 늘어난다(채팅 히스토리 전체).
- "AI를 어떻게 부렸나"의 의도는 최종 코드 구조에도 상당 부분 드러난다(AI 없이 만들기 어려운 구조 등).
- 루브릭 기준 설명을 "코드에서 읽을 수 있다"로 수정해 채점기·교수·학생 모두 기대치를 맞춤(2026-06-25).

**향후 대화 포함을 원하면:** `ChallengeGradingRequest`에 `prompts` 필드를 추가하고
`gradeRubric` 입력에 전달하는 별도 설계 논의가 필요하다(Breaking Change — Blocking 결정).

---

## 6. 구현 작업 목록

### A. 타입·데이터 (Blocking 확정 후)
- [x] `ChallengeKind`·`MlSpec`(+`MlMetric`·`MlEvalResult`·`MlGradingResult`) 추가, `ChallengeProblem.kind`/`ml` 필드.
- [x] `challengeStore` persist **version 4 + migrate** — 기존 챌린지 `kind: 'workspace'` backfill.

### B. 템플릿
- [x] `webcontainerTemplates.ts`에 TF.js ML 템플릿 추가(분류·회귀 2종):
      `package.json`(**pure @tensorflow/tfjs** — tfjs-node 불가), `model.mjs`(학생 편집)·`train.mjs`(실험)·
      `eval.mjs`(잠금 — 고정 seed 재학습 → 숨긴 test 점수 센티넬), `data.mjs`(잠금 로더)·`data/train.csv`.
      숨긴 test셋은 `ML_*_TEST_FILES`로 분리. (실제 컨테이너 실행으로 분류 97.2%·회귀 RMSE 5.03 검증)

### C. 실행/채점
- [x] `runtime.ts`: 점수 센티넬(`__DESPY_SCORE__`) 파싱 + `runScoreEval`(타임아웃·seed env) 추가.
- [x] 제출 흐름: `useWorkspace.runEvaluation`이 `testFiles` 주입 → `evalCommand` 실행 → 점수 회수 →
      `mlScore`로 `/api/grade` 전송 → `computeFinalScore`가 성능 비율(`mlScoreRatio`)을 객관 축으로 가중합.
- [x] 성능 점수 + 합격 여부를 제출 결과에 포함(`ChallengeGradingResult.ml` — submissionStore의 `result.ml`).

### D. UI (DI 원칙 — props 주입)
- [x] 교수: `ChallengeForm`에 `kind` 선택 + ML 프리셋(분류/회귀) + ML 필드(지표·임계값·seed·경로·evalCommand).
- [x] 학생: 워크스페이스에 **성능 점수 탭**(평가 실행 → 정확도/RMSE 게이지·합격 배지) + 결과 모달 성능 섹션.
- [ ] (선택) 학습 곡선 실시간 차트 — epoch별 loss/accuracy 센티넬 시각화. (미구현 — 후속)

### E. 문서
- [x] CLAUDE.md 디렉토리 구조·persist key(v4)·타입·ML 도메인 갱신.
- [x] 단위 테스트: `mlScore.test.ts`(지표 판정·환산 + ML 가중합 11케이스).

---

## 7. 한계·리스크 (UI에 명시)

- **데이터 누수**: 학생이 train에 test 정보를 섞어 점수를 부풀릴 수 있음 → 점수가 곧 실력은 아님.
  숨긴 test + seed 고정으로 완화하나 완벽 차단은 아님(무결성 한계, 기존 채점 한계 고지와 동일 톤).
- **TF.js 범위**: sklearn류 고전 ML은 못 씀 → 문제는 신경망/기초 분류 위주로 출제.
- **컨테이너 실행 보안**: 학생 코드를 브라우저 컨테이너에서 실행 — WebContainer 샌드박스에 의존.

---

## 8. ⚠️ Blocking 결정 (확정됨 — 2026-06-25)

1. **데이터 모델**: ML을 `ChallengeProblem.kind` 확장으로 얹는다 vs 별도 타입/스토어 분리.
   - ✅ **확장 확정** — 워크스페이스·제출·AI 채팅 인프라 재활용, 코드 중복 최소.
2. **첫 문제 범위**: 분류(정확도)만 vs 회귀 포함.
   - ✅ **분류 + 회귀 둘 다 확정** — `MlMetric = 'accuracy' | 'rmse'`, 합격 방향(≥/≤)·환산을 metric에서 파생.
3. **성능 점수 신뢰 경계**(구현 중 추가):
   - ✅ **브라우저 컨테이너 계산 확정** — 새 백엔드 없이 MVP. 서버 재실행 재검증은 후속(현재 `/api/grade`의
     autoTest 신뢰 경계와 동일 — UI에 '서버 재검증 아님' 명시). 서버 재실행은 Blocking 별도 논의.

> Python ML(Pyodide/서버 Docker)은 **이번 범위 밖**. 요구되면 아키텍처 영향이 커 별도 명세로 논의.

---

## 9. 해커톤 최소 데모 (Smallest viable)

> **분류 문제 1개(Iris/MNIST 서브셋) + TF.js 템플릿 + 정확도 임계값 채점 + AI 활용 정성 채점.**
> 이 한 개가 end-to-end로 돌면 "통제된 AI로 ML 문제 풀기"라는 despy 차별점이 데모로 증명된다.
