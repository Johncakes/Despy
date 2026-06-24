/**
 * useHasMounted.ts — 클라이언트 마운트 여부 훅
 *
 * persist된 Zustand 스토어(localStorage)는 서버 렌더 시점에 시드 값을, 클라이언트
 * 마운트 후 저장값을 갖는다. 이 차이로 인한 hydration mismatch를 피하기 위해
 * 스토어 의존 UI는 마운트 이후에만 렌더한다.
 *
 * useSyncExternalStore로 서버 스냅샷(false)/클라이언트 스냅샷(true)을 구분해
 * effect 내 setState 없이 마운트 여부를 안전하게 판별한다.
 *
 * 사용처: 스토어 데이터를 읽는 page/뷰의 초기 렌더 가드
 */
import { useSyncExternalStore } from 'react';

// 외부 상태 변화 없음 — 구독은 noop, 스냅샷만 서버/클라이언트로 구분한다.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
