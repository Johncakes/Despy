/**
 * page.tsx (/playground) — WebContainer P0 PoC 진입점
 *
 * cross-origin isolation 헤더 적용 → WebContainer 부팅 → 샘플 프로젝트 미리보기까지를
 * 검증하는 P0 PoC 화면의 라우팅 진입점. 도메인 로직은 두지 않고 뷰만 렌더한다.
 *
 * WebContainer는 브라우저 전용이라 클라이언트 컴포넌트로만 동작한다(실제 부팅은
 * 뷰의 useWorkspace 이펙트에서 동적 import로 일어나므로 SSR에서 평가되지 않는다).
 *
 * 사용처: Next.js App Router '/playground' 경로
 */
'use client';

import { PageShell } from '@/shared/components/ui/PageShell';
import { WorkspacePlaygroundView } from '@/features/solve/WorkspacePlaygroundView';

export default function PlaygroundPage() {
  return (
    <PageShell>
      <WorkspacePlaygroundView />
    </PageShell>
  );
}
