/**
 * mlScore.ts — ML 지표(metric) 방향·합격 판정·표시 헬퍼 (순수 함수, 모델 비의존)
 *
 * ML 챌린지의 성능 지표는 종류마다 "좋음"의 방향이 다르다(accuracy는 높을수록,
 * RMSE는 낮을수록). 합격 판정(임계값 비교 방향), 표시 형식(백분율 vs 소수), 게이지
 * 채움 비율, 최종 점수 가중합용 [0,1] 환산을 이 한 곳에서 metric으로부터 파생해,
 * UI(WorkspacePanel·결과 모달)와 채점(score.ts·/api/grade)이 같은 규칙을 공유한다.
 *
 * 레이어 규칙: 외부 의존 없는 순수 로직. shared/core 타입만 참조.
 *
 * 사용처: shared/lib/grader/score(가중합), app/api/grade(합격 판정),
 *         features/solve(성능 점수 패널·결과 모달)
 */
import type { MlMetric } from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/** 지표 메타데이터 — 표시 라벨과 "좋음"의 방향. */
export interface MlMetricMeta {
  /** 표시 라벨 (예: '정확도', 'RMSE') */
  label: string;
  /** 값이 클수록 좋은 지표인지 (accuracy=true, rmse=false) */
  higherIsBetter: boolean;
}

// ── 지표 메타 ─────────────────────────────────────────────────────────────

const METRIC_META: Record<MlMetric, MlMetricMeta> = {
  accuracy: { label: '정확도', higherIsBetter: true },
  rmse: { label: 'RMSE', higherIsBetter: false },
};

/** metric의 메타데이터를 반환한다(미지원 값은 accuracy로 보수 처리). */
export function mlMetricMeta(metric: MlMetric): MlMetricMeta {
  return METRIC_META[metric] ?? METRIC_META.accuracy;
}

// ── 판정·표시 ─────────────────────────────────────────────────────────────

/**
 * 지표값이 임계값 기준 합격인지 판정한다.
 * - accuracy(높을수록 좋음): value ≥ passThreshold
 * - rmse(낮을수록 좋음): value ≤ passThreshold
 * 유한수가 아니면(NaN·Infinity) 불합격으로 본다.
 */
export function isMlPassing(
  metric: MlMetric,
  value: number,
  passThreshold: number,
): boolean {
  if (!Number.isFinite(value)) return false;
  return mlMetricMeta(metric).higherIsBetter
    ? value >= passThreshold
    : value <= passThreshold;
}

/** 표시용 값 포맷 — accuracy는 백분율(92.0%), rmse는 소수 3자리(5.072). */
export function formatMlValue(metric: MlMetric, value: number): string {
  if (!Number.isFinite(value)) return '—';
  return metric === 'accuracy' ? `${(value * 100).toFixed(1)}%` : value.toFixed(3);
}

/**
 * 성능 지표를 [0,1] 비율로 환산한다(게이지 채움·최종 점수 가중합용).
 * - accuracy: value 자체(0~1)를 [0,1]로 클램프.
 * - rmse(낮을수록 좋음): passThreshold/value로 환산 — 임계값에 도달하면 1, 더 나쁘면 <1,
 *   더 좋아도 1로 상한(최종 점수 100 초과 방지). value≤0(완벽)이면 1.
 */
export function mlScoreRatio(
  metric: MlMetric,
  value: number,
  passThreshold: number,
): number {
  if (!Number.isFinite(value)) return 0;
  if (metric === 'accuracy') return clamp01(value);
  if (value <= 0) return 1;
  if (passThreshold <= 0) return 0;
  return clamp01(passThreshold / value);
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
