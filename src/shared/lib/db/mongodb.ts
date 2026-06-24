/**
 * mongodb.ts — MongoDB 연결 싱글턴
 *
 * dev hot-reload 시 매번 새 커넥션이 생기는 것을 막기 위해 globalThis에 연결
 * Promise를 캐시한다. prod는 모듈 스코프로 1회 생성한다.
 *
 * 연결은 **호출 시점(lazy)** 에 생성한다 — import만으로 throw하면 MONGODB_URI가
 * 없는 빌드/테스트/CI에서 무관한 모듈까지 깨지기 때문이다. DB가 필요한 경로
 * (인증·유저 리포지토리)에서 getClient()/getDb()를 호출할 때 비로소 URI를 검사한다.
 *
 * 사용처: shared/lib/db/users.ts (유저 리포지토리), scripts/seed-admin.ts
 */
import { MongoClient, type Db } from 'mongodb';

const DEFAULT_DB_NAME = 'despy';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * MongoClient 연결 Promise를 반환한다(싱글턴). 최초 호출 시 MONGODB_URI를 검사하고
 * 연결을 시작한다. dev에서는 globalThis에 캐시해 hot-reload 커넥션 누수를 막는다.
 */
export function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      '환경 변수 MONGODB_URI가 설정되지 않았습니다. .env.local을 확인하세요.',
    );
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

/**
 * 애플리케이션 DB 핸들을 반환한다. DB 이름은 연결 URI 경로(예: .../despy)를 따르며,
 * URI에 DB가 없으면 'despy'로 폴백한다.
 */
export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME);
}
