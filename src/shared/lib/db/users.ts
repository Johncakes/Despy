/**
 * users.ts — 사용자 리포지토리 (MongoDB `users` 컬렉션)
 *
 * 인증·권한에 필요한 사용자 CRUD를 한 곳에 격리한다. 저장 문서(UserDoc)는
 * passwordHash를 포함하지만, 외부로 나가는 값은 항상 AuthUser(민감 필드 제외)로
 * 매핑한다. email 유니크 인덱스를 보장해 중복 가입을 막는다.
 *
 * 사용처: app/api/auth/*, app/api/admin/*, scripts/seed-admin.ts (서버 전용)
 */
import { ObjectId, type Collection } from 'mongodb';
import { getDb } from '@/shared/lib/db/mongodb';
import type { AuthUser, UserRole } from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/** MongoDB에 저장되는 사용자 문서. passwordHash는 응답에 절대 포함하지 않는다. */
export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
}

// ── 컬렉션 핸들 ───────────────────────────────────────────────────────────────

let indexesEnsured = false;

async function usersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  const collection = db.collection<UserDoc>('users');
  if (!indexesEnsured) {
    // 이메일은 소문자 정규화해 저장하므로 단순 유니크 인덱스로 충분하다.
    await collection.createIndex({ email: 1 }, { unique: true });
    indexesEnsured = true;
  }
  return collection;
}

/** 이메일을 비교·저장용으로 정규화한다(공백 제거 + 소문자). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** UserDoc → AuthUser (passwordHash 등 민감 필드 제외). */
export function toAuthUser(doc: UserDoc): AuthUser {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
  };
}

// ── 조회 ───────────────────────────────────────────────────────────────────

/** 이메일로 사용자 문서를 조회한다(없으면 null). 비밀번호 검증용이라 Doc 전체 반환. */
export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const collection = await usersCollection();
  return collection.findOne({ email: normalizeEmail(email) });
}

/** id로 사용자 문서를 조회한다(없으면 null). 잘못된 id 형식이면 null. */
export async function findUserById(id: string): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await usersCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

/** 전체 사용자 목록(관리자 화면용). 가입 최신순, AuthUser로 매핑해 반환. */
export async function listUsers(): Promise<AuthUser[]> {
  const collection = await usersCollection();
  const docs = await collection.find({}, { sort: { createdAt: -1 } }).toArray();
  return docs.map(toAuthUser);
}

// ── 생성 / 수정 ───────────────────────────────────────────────────────────────

/**
 * 신규 사용자를 생성한다. 이메일은 정규화해 저장하며, 중복이면 유니크 인덱스
 * 위반으로 throw된다(호출부에서 409로 변환). 반환은 AuthUser.
 */
export async function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}): Promise<AuthUser> {
  const collection = await usersCollection();
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: normalizeEmail(params.email),
    passwordHash: params.passwordHash,
    name: params.name.trim(),
    role: params.role,
    createdAt: new Date(),
  };
  await collection.insertOne(doc);
  return toAuthUser(doc);
}

/** 사용자 역할을 변경한다(관리자 전용). 변경된 AuthUser를 반환(없으면 null). */
export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<AuthUser | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await usersCollection();
  const doc = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { role } },
    { returnDocument: 'after' },
  );
  return doc ? toAuthUser(doc) : null;
}

/** 마지막 로그인 시각을 갱신한다(로그인 성공 시 호출). */
export async function touchLastLogin(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const collection = await usersCollection();
  await collection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { lastLoginAt: new Date() } },
  );
}
