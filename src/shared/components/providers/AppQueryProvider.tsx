/**
 * AppQueryProvider.tsx — TanStack Query 클라이언트 프로바이더
 *
 * QueryClient를 컴포넌트 인스턴스 단위로 1회 생성(useState lazy init)해
 * 요청 간 캐시를 공유하면서도 SSR/리렌더 시 재생성되지 않도록 한다.
 *
 * 사용처: AppProviders
 */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function AppQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
