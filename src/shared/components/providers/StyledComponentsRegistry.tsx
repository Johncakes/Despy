/**
 * StyledComponentsRegistry.tsx — styled-components SSR 스타일 레지스트리
 *
 * App Router(서버 컴포넌트) 환경에서 styled-components가 생성한 스타일을
 * 서버 렌더 결과(<head>)에 주입하기 위한 표준 패턴. 이게 없으면 첫 페인트에
 * 스타일이 누락되어 깜빡임(FOUC)이 발생한다.
 *
 * 사용처: app/layout.tsx (AppProviders 내부)
 * 참고: https://nextjs.org/docs/app/guides/css-in-js#styled-components
 */
'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { useState } from 'react';
import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

export function StyledComponentsRegistry({ children }: { children: React.ReactNode }) {
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement();
    styledComponentsStyleSheet.instance.clearTag();
    return <>{styles}</>;
  });

  // 클라이언트에서는 일반 렌더 (StyleSheetManager 미적용)
  if (typeof window !== 'undefined') return <>{children}</>;

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  );
}
