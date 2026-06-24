# despy 명세서 — ML 챌린지 (TensorFlow.js 기반)

> **상태: 계획 · 검토 대기 (Blocking 결정 2건 미확정 — §8)**
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
   ② 정성: Gemini가 대화 기록 + 코드로 "AI 활용" 루브릭 채점
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
| **② AI 활용 (정성)** | 제한된 AI를 어떻게 부렸나 | Gemini가 대화 기록+코드로 루브릭 채점 | `geminiGrader.ts`, `GradingRubric` |

- **성능 점수는 클라이언트가 아니라 컨테이너 실행 결과**에서만 나온다(학생이 조작 불가한 숨긴 test).
- **seed 고정** 필수 — 동일 코드의 점수 변동(double-digit 편차 보고됨)을 제거해 공정성 확보.

---

## 6. 구현 작업 목록

### A. 타입·데이터 (Blocking 확정 후)
- [ ] `ChallengeKind`·`MlSpec` 추가, `ChallengeProblem.kind`/`ml` 필드.
- [ ] `challengeStore` persist **version 올리고 migrate** — 기존 챌린지 `kind: 'workspace'` 부여. (필수)

### B. 템플릿
- [ ] `webcontainerTemplates.ts`에 TF.js ML 템플릿 추가:
      `package.json`(@tensorflow/tfjs-node 또는 tfjs), `train.mjs`(학습 골격),
      `eval.mjs`(숨긴 test 로드 → 예측 → 점수 센티넬 출력), `data/train.csv`.

### C. 실행/채점
- [ ] `runtime.ts`: 점수 센티넬(`__DESPY_SCORE__`) 파싱 추가(기존 로그 센티넬 패턴 확장).
- [ ] 제출 흐름: `testFiles` 주입 → `evalCommand` 실행 → 점수 회수 → 임계값 판정.
- [ ] 성능 점수 + 합격 여부를 제출 결과에 포함(`submissionStore` 확장).

### D. UI (DI 원칙 — props 주입)
- [ ] 교수: `ChallengeForm`에 `kind` 선택 + ML 필드(지표·임계값·seed·데이터 업로드).
- [ ] 학생: 워크스페이스에 **성능 점수 패널**(현재 정확도·합격 임계값 게이지).
- [ ] (선택) 학습 곡선 실시간 차트 — epoch별 loss/accuracy 센티넬 시각화.

### E. 문서
- [ ] CLAUDE.md 디렉토리 구조·persist key·타입 갱신(작업 완료 시).

---

## 7. 한계·리스크 (UI에 명시)

- **데이터 누수**: 학생이 train에 test 정보를 섞어 점수를 부풀릴 수 있음 → 점수가 곧 실력은 아님.
  숨긴 test + seed 고정으로 완화하나 완벽 차단은 아님(무결성 한계, 기존 채점 한계 고지와 동일 톤).
- **TF.js 범위**: sklearn류 고전 ML은 못 씀 → 문제는 신경망/기초 분류 위주로 출제.
- **컨테이너 실행 보안**: 학생 코드를 브라우저 컨테이너에서 실행 — WebContainer 샌드박스에 의존.

---

## 8. ⚠️ Blocking 결정 (착수 전 확정 필요)

1. **데이터 모델**: ML을 `ChallengeProblem.kind` 확장으로 얹는다(본 계획 제안) vs 별도 타입/스토어 분리.
   - 제안: **확장** — 워크스페이스·제출·AI 채팅 인프라 재활용, 코드 중복 최소.
2. **첫 문제 범위**: 분류(정확도) 1종으로 시작한다(제안) vs 회귀 포함.
   - 제안: **분류 1종** — 해커톤 데모에 충분, 점수 골격 검증 후 확장.

> Python ML(Pyodide/서버 Docker)은 **이번 범위 밖**. 요구되면 아키텍처 영향이 커 별도 명세로 논의.

---

## 9. 해커톤 최소 데모 (Smallest viable)

> **분류 문제 1개(Iris/MNIST 서브셋) + TF.js 템플릿 + 정확도 임계값 채점 + AI 활용 정성 채점.**
> 이 한 개가 end-to-end로 돌면 "통제된 AI로 ML 문제 풀기"라는 despy 차별점이 데모로 증명된다.
