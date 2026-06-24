/**
 * challenges.ts — 과제 리포지토리 (MongoDB `challenges` 컬렉션)
 *
 * 교수가 출제하는 워크스페이스/ML 과제의 서버 영속을 한 곳에 격리한다(M4 — 영속 이전).
 * 저장 문서(ChallengeDoc)는 채점 재료(testFiles·rubric)와 민감정보(aiPolicy.systemPrompt·
 * ml.seed·ml.testDataPath)를 포함하지만, 학생에게 나가는 값은 항상 StudentChallenge로
 * 매핑해 그 필드들을 제거한다. 전체 노출은 출제자 본인·admin(toAuthorChallenge)뿐이다.
 *
 * 소유권/인가 판단은 라우트가 담당하고, 이 리포지토리는 데이터 접근만 격리한다.
 *
 * 사용처: app/api/challenges/* (서버 전용)
 */
import { ObjectId, type Collection } from 'mongodb';
import { getDb } from '@/shared/lib/db/mongodb';
import type {
  ChallengeInput,
  ChallengeProblem,
  ChallengeStatus,
  StudentChallenge,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

// ChallengeInput은 core/types로 승격되었다(클라이언트 api와 공유). 라우트 import 호환 위해 재노출.
export type { ChallengeInput };

/** MongoDB에 저장되는 과제 문서. 채점 재료·민감정보를 포함하므로 학생 응답엔 매핑 후 노출한다. */
export interface ChallengeDoc {
  _id: ObjectId;
  /** 출제자(교수) id = AuthUser.id */
  authorId: string;
  status: ChallengeStatus;
  title: string;
  statement: string;
  kind: ChallengeProblem['kind'];
  ml?: ChallengeProblem['ml'];
  template: ChallengeProblem['template'];
  lockedPaths: string[];
  editablePaths: string[];
  setupCommands: string[];
  devCommand: string;
  testCommand: string;
  testFiles: ChallengeProblem['testFiles'];
  rubric: ChallengeProblem['rubric'];
  aiPolicy: ChallengeProblem['aiPolicy'];
  createdAt: Date;
  updatedAt: Date;
}

// ── 컬렉션 핸들 ───────────────────────────────────────────────────────────────

let indexesEnsured = false;

async function challengesCollection(): Promise<Collection<ChallengeDoc>> {
  const db = await getDb();
  const collection = db.collection<ChallengeDoc>('challenges');
  if (!indexesEnsured) {
    await collection.createIndex({ authorId: 1 });
    await collection.createIndex({ status: 1 });
    indexesEnsured = true;
  }
  return collection;
}

// ── 매핑 (Doc → 도메인/DTO) ───────────────────────────────────────────────────

/** ChallengeDoc → ChallengeProblem (전체 — 출제자·admin 전용). */
export function toAuthorChallenge(doc: ChallengeDoc): ChallengeProblem {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    statement: doc.statement,
    kind: doc.kind,
    ml: doc.ml,
    template: doc.template,
    lockedPaths: doc.lockedPaths,
    editablePaths: doc.editablePaths,
    setupCommands: doc.setupCommands,
    devCommand: doc.devCommand,
    testCommand: doc.testCommand,
    testFiles: doc.testFiles,
    rubric: doc.rubric,
    aiPolicy: doc.aiPolicy,
    authorId: doc.authorId,
    status: doc.status,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  };
}

/**
 * ChallengeDoc → StudentChallenge (rubric 제거 — 학생 전용).
 *
 * rubric은 항상 제거(채점은 서버 확정). ML 과제는 클라 성능평가에 testFiles + full ml이
 * 필요해 interim으로 노출하고(결정 A), 워크스페이스 과제는 testFiles/ml을 노출하지 않는다.
 * aiPolicy(systemPrompt 포함)는 아직 클라가 /api/agent로 주입하므로 유지한다(M5에서 분리).
 */
export function toStudentChallenge(doc: ChallengeDoc): StudentChallenge {
  const student: StudentChallenge = {
    id: doc._id.toHexString(),
    title: doc.title,
    statement: doc.statement,
    kind: doc.kind,
    template: doc.template,
    lockedPaths: doc.lockedPaths,
    editablePaths: doc.editablePaths,
    setupCommands: doc.setupCommands,
    devCommand: doc.devCommand,
    testCommand: doc.testCommand,
    aiPolicy: doc.aiPolicy,
    authorId: doc.authorId,
    status: doc.status,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  };
  // ML 과제: 클라 성능평가(runEvaluation)에 숨긴 test셋 + full ml이 필요하다(interim 타협).
  if (doc.kind === 'ml' && doc.ml) {
    student.ml = doc.ml;
    student.testFiles = doc.testFiles;
  }
  return student;
}

// ── 조회 ───────────────────────────────────────────────────────────────────

/** 출제자 본인의 과제 목록(최신순) — 전체 필드. */
export async function listChallengesByAuthor(
  authorId: string,
): Promise<ChallengeProblem[]> {
  const collection = await challengesCollection();
  const docs = await collection
    .find({ authorId }, { sort: { updatedAt: -1 } })
    .toArray();
  return docs.map(toAuthorChallenge);
}

/** 전체 과제 목록(admin 전용) — 전체 필드. */
export async function listAllChallenges(): Promise<ChallengeProblem[]> {
  const collection = await challengesCollection();
  const docs = await collection.find({}, { sort: { updatedAt: -1 } }).toArray();
  return docs.map(toAuthorChallenge);
}

/** 학생에게 공개된(published) 과제 목록 — 민감정보 제거 DTO. */
export async function listPublishedChallenges(): Promise<StudentChallenge[]> {
  const collection = await challengesCollection();
  const docs = await collection
    .find({ status: 'published' }, { sort: { updatedAt: -1 } })
    .toArray();
  return docs.map(toStudentChallenge);
}

/**
 * id로 과제 문서를 조회한다(서버 내부용 — 소유권 검사·채점 재료 로드).
 * 없거나 잘못된 id면 null. 매핑 전 원본 Doc을 돌려주므로 절대 그대로 학생에게 응답하지 않는다.
 */
export async function findChallengeDoc(id: string): Promise<ChallengeDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await challengesCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

// ── 생성 / 수정 / 삭제 ─────────────────────────────────────────────────────────

/** 신규 과제를 생성한다(출제자=authorId). 기본 상태는 'draft'. 반환은 전체 ChallengeProblem. */
export async function createChallenge(
  authorId: string,
  input: ChallengeInput,
  status: ChallengeStatus = 'draft',
): Promise<ChallengeProblem> {
  const collection = await challengesCollection();
  const now = new Date();
  const doc: ChallengeDoc = {
    _id: new ObjectId(),
    authorId,
    status,
    title: input.title,
    statement: input.statement,
    kind: input.kind,
    ml: input.ml,
    template: input.template,
    lockedPaths: input.lockedPaths,
    editablePaths: input.editablePaths,
    setupCommands: input.setupCommands,
    devCommand: input.devCommand,
    testCommand: input.testCommand,
    testFiles: input.testFiles,
    rubric: input.rubric,
    aiPolicy: input.aiPolicy,
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  return toAuthorChallenge(doc);
}

/**
 * 과제를 수정한다. 소유권 검사는 라우트가 끝낸 뒤 호출하므로 여기선 _id로만 갱신한다.
 * updatedAt을 갱신하고, 변경된 전체 ChallengeProblem(없으면 null)을 반환한다.
 */
export async function updateChallenge(
  id: string,
  patch: Partial<ChallengeInput> & { status?: ChallengeStatus },
): Promise<ChallengeProblem | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await challengesCollection();
  // 화이트리스트 — 클라이언트가 보낸 patch를 그대로 $set하면 authorId·_id·createdAt
  // 같은 필드까지 덮어쓸 수 있다(무결성 위험). 허용된 출제 필드만 골라 갱신한다.
  const updates: Partial<ChallengeDoc> = { updatedAt: new Date() };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.statement !== undefined) updates.statement = patch.statement;
  if (patch.kind !== undefined) updates.kind = patch.kind;
  if (patch.ml !== undefined) updates.ml = patch.ml;
  if (patch.template !== undefined) updates.template = patch.template;
  if (patch.lockedPaths !== undefined) updates.lockedPaths = patch.lockedPaths;
  if (patch.editablePaths !== undefined) updates.editablePaths = patch.editablePaths;
  if (patch.setupCommands !== undefined) updates.setupCommands = patch.setupCommands;
  if (patch.devCommand !== undefined) updates.devCommand = patch.devCommand;
  if (patch.testCommand !== undefined) updates.testCommand = patch.testCommand;
  if (patch.testFiles !== undefined) updates.testFiles = patch.testFiles;
  if (patch.rubric !== undefined) updates.rubric = patch.rubric;
  if (patch.aiPolicy !== undefined) updates.aiPolicy = patch.aiPolicy;
  if (patch.status !== undefined) updates.status = patch.status;

  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' },
  );
  return doc ? toAuthorChallenge(doc) : null;
}

/** 과제를 삭제한다. 소유권 검사는 라우트가 끝낸 뒤 호출한다. 삭제 여부 반환. */
export async function deleteChallenge(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await challengesCollection();
  const res = await collection.deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
