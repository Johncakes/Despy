# 코딩 컨벤션 (Conventions)

> despy 코딩 규칙 상세. 요약은 `CLAUDE.md` 참조.

---

## 📁 파일 명명 규칙

| 종류 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 | PascalCase | `ItemCard.tsx` |
| 스토어 | `*Store.ts` | `settingsStore.ts` |
| API | `*Api.ts` | `itemApi.ts` |
| Query 훅 | `*Queries.ts` | `itemQueries.ts` |
| 훅 | `use*.ts` | `useCardGestures.ts` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 타입 | PascalCase, 공유 타입은 `shared/core/types/`에만 | `ContentItem` |

---

## 📝 파일 상단 JSDoc (모든 파일 필수)

```typescript
/**
 * 파일명.ts — 한줄 요약
 *
 * 상세 설명 (무엇을, 왜, 어떻게)
 *
 * 사용처: 어디에서 사용되는지
 */
```

---

## 🧱 파일 내 코드 순서

| 파일 타입 | 순서 |
|---|---|
| 컴포넌트 | Imports → Constants → Types → Component 함수 → Styled Components |
| 훅 | Types → Hook 함수 (Refs → State → Callbacks → Effects → Return) |
| Store | Types → 초기 상태 → Store 정의 → Selector 헬퍼 |

### 섹션 구분선 (파일 크기별)
- **300줄+**: `═══` 메인 + `━━━` 서브
- **100~300줄**: `───` 간단한 구분선
- **100줄 미만**: 구분선 없이 JSDoc만

### 기존 주석 보전 원칙 (가장 중요)
- 기존 주석을 **삭제/축약하지 않는다**. 코드 정리 시에도 주석은 보전.

---

## 📦 Import 순서

```typescript
// 1. React / Next
import { useState } from 'react';
// 2. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';
import styled from 'styled-components';
// 3. 프로젝트 내부 (@/ alias)
import { itemQueries } from '@/shared/core/queries/itemQueries';
```

---

## 🏷 Props 네이밍 규칙 — 이름만으로 역할 파악

> 짧고 모호한 것보다 **길고 명확한 것을 선호**. 단, 제거해도 의미가 같은 단어는 넣지 않는다.

```tsx
// boolean: is / should / has 접두사 + 주어 명시
isScrollFocused        // ✅    isActive (❌ 모호)
shouldHideTopBar       // ✅    hideTopBar (❌ 상태/의도 불명)

// 콜백: on + 명사 + 동사
onItemSelectRequest    // ✅    onSelect (❌ 무엇의?)

// string/number: 포맷·단위 JSDoc 필수
/** CSS gradient 문자열 (예: 'linear-gradient(...)') */
gradient?: string;
```

---

## 🎨 styled-components

- **Transient props** — DOM에 누수되면 안 되는 prop은 `$` 접두사
  ```tsx
  const Box = styled.div<{ $active: boolean }>`
    opacity: ${({ $active }) => ($active ? 1 : 0.5)};
  `;
  ```
- **테마 토큰만 사용** — 색상/spacing 하드코딩 금지
  ```tsx
  color: ${({ theme }) => theme.colors.text};   // ✅
  color: #333;                                   // ❌
  ```
- 테마 타입은 `src/styled.d.ts`에서 `DefaultTheme`에 증강됨 → 전역 타입 안전.

---

## 🗄 상태 관리

### 서버 상태 vs 클라이언트 상태
| 종류 | 도구 |
|---|---|
| 서버 데이터 | TanStack Query (`shared/core/queries/`) |
| 클라이언트·UI 상태 | Zustand (`shared/core/stores/`) |

- 서버 응답을 Zustand에 복사 저장 금지 (Query 캐시가 단일 출처)

### TanStack Query — queryKey 중앙화 (`shared/core/queries/queryKeys.ts`)
```typescript
export const queryKeys = {
  items: {
    all: ['items'] as const,
    detail: (id: string) => ['items', id] as const,
  },
};
```

### Zustand persist
- store별 고유 persist key (`'despy-{domain}'`)
- 스키마 변경 시 `version` 올리고 `migrate()` 작성 **필수**
```typescript
persist(storeImpl, {
  name: 'despy-settings',
  version: 1,
  migrate: (persisted, version) => { /* ... */ },
});
```

---

## 🔧 TypeScript

- `any` 금지. 불가피하면 `unknown` + 타입 가드.
- 공유 타입은 `shared/core/types/`에 단일 출처로 둔다.
- discriminated union 분기 시 타입 가드 함수 작성:
  ```typescript
  const isVersePage = (p: Page): p is VersePage => p.type === 'verse';
  ```

---

## 🧹 금지 사항

- `any` 타입 금지
- 인라인 스타일 지양 (styled-components 사용)
- 하드코딩 색상 금지 (테마 사용)
- `console.log` 커밋 금지 (`logger` 유틸 사용)
- 기존 주석 삭제/축약 금지
- shared → features import 금지 (레이어 위반, `shared/reader`만 예외)

---

## ✅ 권장 사항

- 컴포넌트는 props/render prop으로 의존성 주입 (DI) → shared 레이어 순수성 유지
- 커밋 전 `npm run typecheck` + `npm run lint` (husky가 자동 실행)
- 테스트는 vitest, 핵심 로직 위주
