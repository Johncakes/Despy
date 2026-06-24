/**
 * idbStorage.ts — zustand persist용 IndexedDB StateStorage 어댑터 (네이티브)
 *
 * localStorage(~5MB)는 워크스페이스 파일 버퍼를 담기엔 작아(quota 초과 위험,
 * docs/spec-webcontainer.md §9.1) 용량 여유가 큰 IndexedDB에 영속한다. zustand
 * persist가 기대하는 StateStorage(getItem/setItem/removeItem)를 단일 objectStore
 * ('keyval') 위에 얇게 구현한다. 외부 라이브러리(idb 등) 도입 없이 브라우저
 * IndexedDB API만 사용한다(P4 결정 — 새 의존성 0).
 *
 * - 비동기: 모든 연산이 Promise라 persist의 rehydrate가 비동기로 일어난다.
 *   스토어는 hasHydrated 플래그로 복원 완료를 노출한다(workspaceStore 참조).
 * - SSR/비브라우저 가드: indexedDB가 없으면 getItem은 null, set/remove는 no-op으로
 *   degrade해 서버 렌더·테스트(jsdom은 IndexedDB 미구현)에서 안전하다.
 *
 * 레이어: shared/core는 외부 라이브러리(여기선 브라우저 IndexedDB API)만 의존한다.
 *
 * 사용처: shared/core/stores/workspaceStore.ts (despy-workspace persist)
 */
import type { StateStorage } from 'zustand/middleware';

// ── Constants ─────────────────────────────────────────────────────────────

const DB_NAME = 'despy';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

// ── DB 핸들 (탭당 1회 오픈, dedup) ───────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

/** 브라우저(IndexedDB 사용 가능) 환경인지. SSR·jsdom 테스트에서는 false. */
function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** 한 트랜잭션 안에서 objectStore 연산 1건을 수행하고 결과를 Promise로 돌려준다. */
function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

// ── StateStorage 구현 ────────────────────────────────────────────────────────

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (!isIndexedDbAvailable()) return null;
    const value = await withStore<string | undefined>('readonly', (store) =>
      store.get(name),
    );
    return value ?? null;
  },
  setItem: async (name, value) => {
    if (!isIndexedDbAvailable()) return;
    await withStore('readwrite', (store) => store.put(value, name));
  },
  removeItem: async (name) => {
    if (!isIndexedDbAvailable()) return;
    await withStore('readwrite', (store) => store.delete(name));
  },
};
