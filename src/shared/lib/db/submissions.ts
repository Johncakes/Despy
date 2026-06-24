/**
 * submissions.ts — 제출 리포지토리 (MongoDB `submissions` 컬렉션)
 *
 * 학생이 과제를 제출해 받은 공식 채점 결과 + 제출 코드·프롬프트 스냅샷을 영속한다
 * (M4 — 교수 채점 대시보드의 서버 데이터 소스). 채점 결과는 제출 문서에 임베드한다
 * (제출과 1:1라 별도 grading_results 컬렉션 불필요 — 알고리즘 트랙의 per-문제 이력과 구분).
 *
 * 접근 통제는 라우트가 담당한다: 읽기는 본인(userId)·부모 과제 출제자(authorId)·admin만.
 * 이 리포지토리는 데이터 접근만 격리한다.
 *
 * 사용처: app/api/challenges/[challengeId]/submissions, app/api/submissions/* (서버 전용)
 */
import { ObjectId, type Collection } from 'mongodb';
import { getDb } from '@/shared/lib/db/mongodb';
import type {
  ChallengeGradingResult,
  IntegrityLog,
  ProjectFiles,
  Submission,
  SubmissionPromptTurn,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/** MongoDB에 저장되는 제출 문서. challengeId·createdAt은 ObjectId·Date로 보관한다. */
export interface SubmissionDoc {
  _id: ObjectId;
  challengeId: ObjectId;
  /** 제출 학생 id = AuthUser.id */
  userId: string;
  studentName: string;
  result: ChallengeGradingResult;
  submittedFiles?: ProjectFiles;
  prompts?: SubmissionPromptTurn[];
  aiUsage?: { questionsUsed: number; tokensUsed: number };
  integrityLog?: IntegrityLog;
  createdAt: Date;
}

/** 제출 생성 입력 — 인증된 식별 정보 + 채점 결과 + 스냅샷. */
export interface CreateSubmissionInput {
  challengeId: string;
  userId: string;
  studentName: string;
  result: ChallengeGradingResult;
  submittedFiles?: ProjectFiles;
  prompts?: SubmissionPromptTurn[];
  aiUsage?: { questionsUsed: number; tokensUsed: number };
  integrityLog?: IntegrityLog;
}

// ── 컬렉션 핸들 ───────────────────────────────────────────────────────────────

let indexesEnsured = false;

async function submissionsCollection(): Promise<Collection<SubmissionDoc>> {
  const db = await getDb();
  const collection = db.collection<SubmissionDoc>('submissions');
  if (!indexesEnsured) {
    // 대시보드: 과제별 최신순. 마이페이지: 학생별 최신순.
    await collection.createIndex({ challengeId: 1, createdAt: -1 });
    await collection.createIndex({ userId: 1, createdAt: -1 });
    indexesEnsured = true;
  }
  return collection;
}

// ── 매핑 ───────────────────────────────────────────────────────────────────

/** SubmissionDoc → Submission (ObjectId→hex, Date→ms). */
export function toSubmission(doc: SubmissionDoc): Submission {
  return {
    id: doc._id.toHexString(),
    challengeId: doc.challengeId.toHexString(),
    userId: doc.userId,
    studentName: doc.studentName,
    result: doc.result,
    submittedFiles: doc.submittedFiles,
    prompts: doc.prompts,
    aiUsage: doc.aiUsage,
    integrityLog: doc.integrityLog,
    createdAt: doc.createdAt.getTime(),
  };
}

// ── 조회 ───────────────────────────────────────────────────────────────────

/** 특정 과제의 모든 제출(최신순) — 교수 대시보드 피드. 잘못된 id면 빈 배열. */
export async function listSubmissionsByChallenge(
  challengeId: string,
): Promise<Submission[]> {
  if (!ObjectId.isValid(challengeId)) return [];
  const collection = await submissionsCollection();
  const docs = await collection
    .find({ challengeId: new ObjectId(challengeId) }, { sort: { createdAt: -1 } })
    .toArray();
  return docs.map(toSubmission);
}

/** 특정 학생의 모든 제출(최신순) — 마이페이지 피드. */
export async function listSubmissionsByUser(
  userId: string,
): Promise<Submission[]> {
  const collection = await submissionsCollection();
  const docs = await collection
    .find({ userId }, { sort: { createdAt: -1 } })
    .toArray();
  return docs.map(toSubmission);
}

/** 단일 제출 문서 조회(서버 내부용 — 소유권 검사). 없거나 잘못된 id면 null. */
export async function findSubmissionDoc(
  id: string,
): Promise<SubmissionDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await submissionsCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

// ── 생성 ───────────────────────────────────────────────────────────────────

/**
 * 제출 1건을 생성한다. challengeId는 호출 전 유효성(존재·ObjectId)을 라우트가 보장한다.
 * 반환은 매핑된 Submission.
 */
export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<Submission> {
  const collection = await submissionsCollection();
  const doc: SubmissionDoc = {
    _id: new ObjectId(),
    challengeId: new ObjectId(input.challengeId),
    userId: input.userId,
    studentName: input.studentName,
    result: input.result,
    submittedFiles: input.submittedFiles,
    prompts: input.prompts,
    aiUsage: input.aiUsage,
    integrityLog: input.integrityLog,
    createdAt: new Date(),
  };
  await collection.insertOne(doc);
  return toSubmission(doc);
}
