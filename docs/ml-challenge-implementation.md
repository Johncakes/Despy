# ML 챌린지 — 구현 현황 / 핸드오프 (2026-06-25)

> [`docs/spec-ml-challenge.md`](./spec-ml-challenge.md)(계획)의 구현 기록이다. 무엇을 만들었고,
> 무엇을 검증했고, **무엇이 아직 막혀 있는지(런타임 검증 이슈)** 와 진단 방법을 정리한다.

---

## 1. 결론 한 줄

타입·채점·스토어·템플릿·UI는 **구현 완료 + typecheck/lint/테스트(94) 통과**. 단, **WebContainer
안에서 `eval.mjs`가 실제로 도는지(= pure tfjs가 WebContainer Node에서 학습/추론되는지)** 는
아직 **미검증**이다(현재 `평가 실행`이 exit 1로 실패 — §6). 이 한 가지가 남은 통합 갭이다.

---

## 2. 확정된 결정 (spec §8)

| 결정 | 확정 |
|---|---|
| 데이터 모델 | `ChallengeProblem.kind` 확장(+`ml?: MlSpec`). 별도 스토어 분리 안 함 |
| 문제 범위 | **분류(accuracy) + 회귀(rmse) 둘 다**. `MlMetric = 'accuracy' \| 'rmse'` |
| 성능 점수 신뢰 경계 | **브라우저 컨테이너 계산**(MVP). 서버 재실행 재검증은 후속(Blocking 별도) |
| ML 런타임 | **pure `@tensorflow/tfjs`** 고정. `tfjs-node`는 네이티브 바인딩이라 WebContainer 불가 |
| 정성 채점 입력 | 코드(`submittedFiles`)만. 대화 트랜스크립트는 채점에 미전달(spec §5a) |

---

## 3. 데이터 흐름 (학생 제출)

```
[학생] model.mjs 편집 (AI 도움) → FS 동기화(fileSync)
   │
   ▼  '성능 점수' 탭 "평가 실행" 또는 "제출"
useWorkspace.runEvaluation()
   ├─ mountProjectFiles(현재 파일 버퍼)        // 최신 편집 반영
   ├─ mountProjectFiles(challenge.testFiles)   // 숨긴 test셋을 채점 시점에만 주입
   └─ runScoreEval('node', ['eval.mjs'], { env:{DESPY_SEED}, timeoutMs })
        → eval.mjs: 고정 seed로 새 모델 학습 → 숨긴 test 예측 → 지표 계산
        → stdout: __DESPY_SCORE__{"metric":"accuracy","value":0.97}__DESPY_SCORE_END__
        ← runScoreEval가 센티넬 파싱 → MlEvalResult{metric,value}
   │
   ▼  (제출일 때)
ChallengeSolveView.handleSubmit → grade.mutateAsync({ mlScore:{metric,value,passThreshold}, ... })
   │
   ▼  POST /api/grade
route.ts: isMlPassing()로 합격 판정 + mlScoreRatio()로 객관 비율 환산
        → computeFinalScore(autoTest=빈, rubric, weights, objectiveRatioOverride=비율)
        → ChallengeGradingResult{ ml:{metric,value,passThreshold,passed}, finalScore }
   │
   ▼
결과 모달(ChallengeGradingResultPanel): 성능 점수 섹션(게이지·합격 배지) + 루브릭
제출 기록(submissionStore): result.ml에 성능 점수 보관 → 교수 대시보드 소스
```

**핵심 불변식**
- 성능 점수(객관)는 **컨테이너 실행 결과**에서만 나온다(학생이 못 바꾸는 숨긴 test + 고정 seed).
- `finalScore`(0~100 가중합)와 `ml.value`(원시 지표 — accuracy 0~1 / rmse)는 **척도가 달라 분리** 보관.
- ML은 `weights.tests` 슬롯이 "성능(객관) 비중", `weights.rubric`이 "AI 활용(정성) 비중"을 뜻한다.

---

## 4. 변경/추가 파일

### 타입·채점 (shared/core, shared/lib/grader, app/api)
| 파일 | 변경 |
|---|---|
| `shared/core/types/index.ts` | `ChallengeKind`·`MlMetric`·`MlSpec`·`MlEvalResult`·`MlGradingResult` 추가. `ChallengeProblem.kind`(필수)·`ml?` / `ChallengeGradingRequest.mlScore?` / `ChallengeGradingResult.ml?` |
| `shared/lib/grader/mlScore.ts` (신규) | `isMlPassing`(accuracy ≥ / rmse ≤)·`mlScoreRatio`([0,1] 환산)·`formatMlValue`·`mlMetricMeta`. UI·채점 공용 순수 함수 |
| `shared/lib/grader/mlScore.test.ts` (신규) | 지표 판정·환산 + ML 가중합 11케이스 |
| `shared/lib/grader/score.ts` | `computeFinalScore`에 `objectiveRatioOverride?` 추가(ML이면 성능 비율이 testsRatio 대체) |
| `shared/lib/grader/requestValidation.ts` | `mlScore`(선택) 형식 검증(`validateMlScore`) |
| `app/api/grade/route.ts` | `mlScore`로 `passed` 판정 + 최종 점수 객관 축 대체, `result.ml` 채움 |

### 스토어
| 파일 | 변경 |
|---|---|
| `shared/core/stores/challengeStore.ts` | persist **v3→v4 migrate**: 기존 과제 `kind:'workspace'` backfill(default-first 보존) + 빠진 ML 샘플 additive 시드 |
| `shared/core/stores/submissionStore.ts` | 스키마 변경 없음(성능 점수는 `result.ml`에 — 선택 필드라 구버전 호환). JSDoc만 정정 |

### 런타임·템플릿
| 파일 | 변경 |
|---|---|
| `shared/lib/webcontainer/runtime.ts` | `__DESPY_SCORE__` 센티넬 + `runScoreEval`(spawn→버퍼→센티넬 슬라이스, **타임아웃 가드 + seed env(DESPY_SEED)**). 실패 시 eval 출력 꼬리를 에러에 동봉(자가 진단) |
| `shared/core/constants/webcontainerTemplates.ts` | `ML_CLASSIFICATION_TEMPLATE`·`ML_REGRESSION_TEMPLATE` + `ML_*_TEST_FILES`(숨긴 test) + `ML_*_LOCKED_PATHS`. 각 템플릿: `model.mjs`(학생 편집)·`train.mjs`(실험)·`eval.mjs`(잠금 채점)·`data.mjs`(잠금 로더, 회귀는 표준화기)·`data/train.csv`(잠금)·`package.json`(tfjs) |
| `shared/core/constants/sampleChallenges.ts` | 샘플 ML 챌린지 2개(`sample-ml-iris-classification` acc≥0.85, `sample-ml-house-regression` rmse≤8.0) |

### UI (DI — props 주입)
| 파일 | 변경 |
|---|---|
| `features/solve/useWorkspace.ts` | `WorkspaceMlConfig` 파라미터, `runEvaluation`/`evalResult`/`isRunningEval`/`evalErrorMessage`. **ML이면 dev 서버 스킵**(install 후 바로 ready) |
| `features/solve/components/WorkspacePanel.tsx` | ML이면 미리보기·테스트 대신 **'성능 점수' 탭**(평가 실행 버튼 + 정확도/RMSE 게이지 + 합격 배지) |
| `features/solve/ChallengeSolveView.tsx` | `mlConfig` 주입, `handleSubmit`가 `kind==='ml'`이면 `runEvaluation`→`mlScore` 전송. 제출 라벨/진행 오버레이에 평가 단계 반영 |
| `features/solve/components/ChallengeGradingResultPanel.tsx` | 결과 모달에 성능 점수 섹션(지표·합격 기준·게이지) + ML 무결성 고지. 워크스페이스 과제는 기존 자동 테스트 섹션 |
| `features/author/components/ChallengeForm.tsx` | `kind` 선택 + ML 프리셋(분류/회귀 1클릭 적재) + MlSpec 필드(지표·임계값·seed·경로·evalCommand) + ML 유효성 |

### 문서
- `CLAUDE.md` — 디렉토리 구조·persist key(v4)·타입·ML 도메인 갱신.
- `docs/spec-ml-challenge.md` — 상태/§6 체크박스/§8 결정 확정.
- (이 문서) `docs/ml-challenge-implementation.md`.

---

## 5. 검증한 것 (증거)

1. **pure tfjs 설치/학습(일반 Node v22)** — `@tensorflow/tfjs@4.22` `npm install`: 66패키지·7초·**네이티브 빌드/node-gyp 없음**. 작은 모델 50 epoch 학습 **82ms**, 센티넬 정상 출력.
2. **데이터셋 학습성** — 시드 고정 합성 데이터. 분류 test **정확도 97.2%**, 회귀 test **RMSE 5.03**. → 합격 임계값을 acc 0.85 / rmse 8.0으로 설정.
3. **결정성** — `glorotUniform({seed})` + `shuffle:false`로 eval 2회 실행 시 **점수 완전 동일**.
4. **소스 round-trip** — despy 소스에서 `ML_*_TEMPLATE`/`ML_*_TEST_FILES`를 실제로 import→파일로 풀어 `node eval.mjs` 실행 → 임베딩(이스케이프) 후에도 **동일 점수**(cls 0.9722 / reg 5.026). 즉 임베딩은 byte-correct.
5. **정적 검사** — `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` **94 통과(9파일, ML 11케이스 포함)**.

> ⚠️ 위 1·4는 **일반 Node**에서의 검증이다. **WebContainer(WASM Node) 안에서의 tfjs 실행은 아직 검증하지 못했다** — 아래 §6.

---

## 6. ⚠️ 남은 런타임 이슈 (OPEN)

### 6.1 `평가 실행` exit 1 — eval이 WebContainer에서 점수 출력 전에 실패
- 증상: `점수 출력을 찾지 못했습니다 (exit 1)`. eval 프로세스는 spawn됐으나 센티넬 전에 종료.
- 일반 Node에선 동일 eval이 정상 동작(§5.4)하므로 **WebContainer-Node 특이 문제**로 추정.
- **진단 방법**: 깨끗한 부팅 후 `평가 실행` → 에러 메시지의 `--- eval 출력 ---` 또는 `콘솔` 탭의 stderr 확인.
  - `Cannot find module '@tensorflow/tfjs'` → 설치/해석 문제(고치기 쉬움).
  - tfjs 내부 에러/미지원 API → **pure tfjs가 WebContainer에서 안 도는 것** → 런타임 재설계 필요
    (대안: `@tensorflow/tfjs-backend-wasm`, 또는 tfjs를 안 쓰는 경량 수치 방식).
- 이 항목이 **데모 성패를 가르는 마지막 미검증 가정**(spec §8 runtime-verification, "playground 스모크 테스트 필요"가 현실화).

### 6.2 `Only a single WebContainer instance can be booted`
- 원인: **코드 버그 아님**. WebContainer는 한 번에 인스턴스 1개만 부팅 가능. despy 탭 여러 개 + 새로고침 직후 이전 인스턴스 잔존이 겹치면 발생.
- 회피: **다른 despy 탭을 모두 닫고 1개만 완전 새로고침**(⌘⇧R) → `준비 완료` 대기 → `평가 실행`.
- 선택 개선(미적용): `runtime.ts`에서 부팅 에러 시 `teardown` 후 1회 재시도 + 이탈 시 정리 → 견고화.

---

## 7. 남은/선택 작업

- [ ] **(필수) 6.1 진단·해결** — WebContainer 안 tfjs 실행 확인. `playground`에서 `npm i @tensorflow/tfjs && node -e "require('@tensorflow/tfjs')"` 스모크 테스트.
- [ ] (선택) 6.2 부팅 충돌 자동 복구(teardown+재시도).
- [ ] (선택) 학습 곡선 실시간 차트(epoch별 loss/accuracy 센티넬 시각화).
- [ ] (후속) 성능 점수 서버 재실행 재검증(서버 TF.js 러너 — 새 백엔드, Blocking).

---

## 8. 빠른 재현 (클린 테스트)

1. despy 탭 1개만 남기고 나머지 닫기.
2. `localhost:3000/workspace/sample-ml-iris-classification` 완전 새로고침.
3. `준비 완료`까지 대기(첫 tfjs 설치 ~30–60초).
4. `성능 점수` 탭 → `평가 실행`.
5. 성공: 정확도 게이지 + 합격/불합격. 실패: 에러의 `--- eval 출력 ---` 줄이 §6.1 원인을 알려줌.
