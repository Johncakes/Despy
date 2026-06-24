/**
 * mongodb.ts — MongoDB 연결 싱글턴
 *
 * dev hot-reload 시 매번 새 커넥션이 생기는 것을 막기 위해
 * globalThis에 Promise를 캐시한다. prod는 모듈 스코프로 1회 생성.
 *
 * 사용처: shared/core/api/*Api.ts (데이터 접근 계층에서만 import)
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('환경 변수 MONGODB_URI가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

const options = {};

let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, options).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri, options).connect();
}

export default clientPromise;
