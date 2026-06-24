/**
 * requestValidation.ts — /api/grade 요청 검증 (순수 함수, 신뢰 경계)
 *
 * 클라이언트가 보낸 채점 요청(신뢰 불가 JSON)의 필수 필드와 weights 합(≈1.0)을
 * 점검한다. weights 합이 1이 아니면 computeFinalScore가 조용히 틀어지므로, 채점
 * 전에 이 경계에서 차단한다. 통과 시 null, 실패 시 사용자 안내 메시지를 반환한다.
 *
 * unknown을 받아 런타임에 좁힌다 — 라우트의 `as` 캐스트는 컴파일 타임 약속일 뿐
 * 실제 페이로드를 보장하지 않으므로, 검증은 타입을 믿지 않고 값을 직접 확인한다.
 *
 * 레이어 규칙: 외부 의존 없는 순수 로직. shared/core 타입만 참조.
 *
 * 사용처: app/api/grade/route.ts
 */
import type { ChallengeGradingRequest } from '@/shared/core/types';

// ── 허용 오차 ─────────────────────────────────────────────────────────────

/** weights 합 검사 허용 오차(부동소수 보정) */
const WEIGHTS_SUM_TOLERANCE = 0.001;

// ── 검증 ─────────────────────────────────────────────────────────────────────

/**
 * 채점 요청을 검증한다. 통과 시 null, 실패 시 첫 위반 사유 메시지를 반환한다.
 * 통과하면 body를 ChallengeGradingRequest로 안전하게 다룰 수 있다.
 */
export function validateGradeRequest(body: unknown): string | null {
  if (!isRecord(body)) return '요청 본문이 올바르지 않습니다.';

  if (!isNonEmptyString(body.problemId)) return 'problemId가 필요합니다.';

  const rubric = body.rubric;
  if (!isRecord(rubric) || !Array.isArray(rubric.criteria)) {
    return 'rubric.criteria가 필요합니다.';
  }

  if (!isRecord(body.submittedFiles)) return 'submittedFiles가 필요합니다.';

  const autoTest = body.autoTest;
  if (!isRecord(autoTest) || typeof autoTest.totalCount !== 'number') {
    return 'autoTest 결과가 필요합니다.';
  }

  const weights = isRecord(rubric.weights) ? rubric.weights : undefined;
  const tests = weights?.tests;
  const rubricWeight = weights?.rubric;
  if (typeof tests !== 'number' || typeof rubricWeight !== 'number') {
    return 'rubric.weights(tests·rubric)가 필요합니다.';
  }
  if (Math.abs(tests + rubricWeight - 1) > WEIGHTS_SUM_TOLERANCE) {
    return 'rubric.weights 합은 1.0이어야 합니다.';
  }

  return null;
}

/** 검증을 통과한 본문을 도메인 타입으로 단언한다(검증 직후에만 사용). */
export function asGradeRequest(body: unknown): ChallengeGradingRequest {
  return body as ChallengeGradingRequest;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
