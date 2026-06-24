/**
 * submissionApi.ts — 제출 데이터 접근 (/api/challenges/[id]/submissions, /api/submissions 호출)
 *
 * 제출 생성(서버 채점+영속)과 조회(과제별·내 제출·단일) fetch를 격리한다. 컴포넌트는
 * 직접 fetch하지 않고 이 모듈(→ submissionQueries 훅)만 쓴다. 채점 기준은 서버가 저장된
 * 과제에서 로드하므로 제출 요청엔 채점 기준을 보내지 않는다(무결성).
 *
 * 사용처: shared/core/queries/submissionQueries
 */
import type {
  ChallengeSubmitRequest,
  Submission,
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

/** 특정 과제의 모든 제출(교수 대시보드 — 부모 출제자만). 비소유 시 서버가 403. */
export async function listChallengeSubmissions(
  challengeId: string,
): Promise<Submission[]> {
  const response = await fetch(`/api/challenges/${challengeId}/submissions`);
  const { submissions } = await parseJson<{ submissions: Submission[] }>(
    response,
  );
  return submissions;
}

/** 내 제출 목록(마이페이지). */
export async function listMySubmissions(): Promise<Submission[]> {
  const response = await fetch('/api/submissions/mine');
  const { submissions } = await parseJson<{ submissions: Submission[] }>(
    response,
  );
  return submissions;
}

/** 단일 제출 조회(본인/출제자/admin). */
export async function getSubmission(id: string): Promise<Submission> {
  const response = await fetch(`/api/submissions/${id}`);
  const { submission } = await parseJson<{ submission: Submission }>(response);
  return submission;
}

// ── 생성 (제출 + 서버 채점) ────────────────────────────────────────────────────

/**
 * 과제를 제출한다. 서버가 저장된 rubric으로 채점해 결과를 영속하고, 채점된 Submission을
 * 돌려준다. 실패(채점 오류 등) 시 서버 메시지로 throw.
 */
export async function submitChallenge(params: {
  challengeId: string;
  request: ChallengeSubmitRequest;
}): Promise<Submission> {
  const response = await fetch(
    `/api/challenges/${params.challengeId}/submissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.request),
    },
  );
  const { submission } = await parseJson<{ submission: Submission }>(response);
  return submission;
}
