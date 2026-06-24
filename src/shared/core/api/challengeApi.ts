/**
 * challengeApi.ts — 과제 데이터 접근 (/api/challenges 호출)
 *
 * 과제 목록·조회·생성·수정·삭제 fetch를 한 곳에 격리한다. 컴포넌트는 직접 fetch하지 않고
 * 이 모듈(→ challengeQueries 훅)만 쓴다. 응답은 역할에 따라 다르다 — 학생은 민감정보가
 * 제거된 StudentChallenge, 출제자·admin은 전체 ChallengeProblem. 호출 맥락(풀이 vs 편집)에
 * 맞는 타입을 노출한다.
 *
 * 사용처: shared/core/queries/challengeQueries
 */
import type {
  ChallengeInput,
  ChallengeProblem,
  ChallengeStatus,
  ChallengeSummary,
  StudentChallenge,
} from '@/shared/core/types';

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/** JSON 응답을 파싱하고, 실패 응답이면 서버 error 메시지로 throw한다. */
async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(data?.error || `요청 실패 (${response.status})`);
  }
  return data as T;
}

// ── 조회 ───────────────────────────────────────────────────────────────────

/** 과제 목록(역할별 필터 — 학생은 published만). 목록 표시용 공통 필드로 받는다. */
export async function listChallenges(): Promise<ChallengeSummary[]> {
  const response = await fetch('/api/challenges');
  const { challenges } = await parseJson<{ challenges: ChallengeSummary[] }>(
    response,
  );
  return challenges;
}

/** 단일 과제(편집용 — 출제자·admin 전체 필드). 비소유 시 서버가 403/404. */
export async function getChallengeForEdit(id: string): Promise<ChallengeProblem> {
  const response = await fetch(`/api/challenges/${id}`);
  const { challenge } = await parseJson<{ challenge: ChallengeProblem }>(
    response,
  );
  return challenge;
}

/** 단일 과제(풀이용 — 학생 DTO, 채점 재료·민감정보 제거). */
export async function getChallengeForSolve(
  id: string,
): Promise<StudentChallenge> {
  const response = await fetch(`/api/challenges/${id}`);
  const { challenge } = await parseJson<{ challenge: StudentChallenge }>(
    response,
  );
  return challenge;
}

// ── 생성 / 수정 / 삭제 ─────────────────────────────────────────────────────────

/** 과제를 생성한다(교수/admin). 반환은 전체 ChallengeProblem. */
export async function createChallenge(
  input: ChallengeInput,
): Promise<ChallengeProblem> {
  const response = await fetch('/api/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { challenge } = await parseJson<{ challenge: ChallengeProblem }>(
    response,
  );
  return challenge;
}

/** 과제를 수정한다(출제자/admin). 변경 필드만 patch로 보낸다. */
export async function updateChallenge(params: {
  id: string;
  patch: Partial<ChallengeInput> & { status?: ChallengeStatus };
}): Promise<ChallengeProblem> {
  const response = await fetch(`/api/challenges/${params.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.patch),
  });
  const { challenge } = await parseJson<{ challenge: ChallengeProblem }>(
    response,
  );
  return challenge;
}

/** 과제를 삭제한다(출제자/admin). */
export async function deleteChallenge(id: string): Promise<void> {
  const response = await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
  await parseJson<{ ok: boolean }>(response);
}
