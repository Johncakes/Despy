# despy — AI Agent Guide

> 에이전틱 코딩 평가 시스템 — 학생이 통제된 AI 에이전트를 활용해 알고리즘 문제를 푸는 과정을 평가하는 웹 서비스.
> 이 문서는 AI 에이전트가 프로젝트 작업 시 **첫 번째로 읽는 지도**입니다.

---

## 프로젝트 개요

AI 코딩 도구가 보편화된 환경에서, "AI를 효과적으로 부려 문제를 푸는 능력"을 정량 평가한다.
교수는 문제·테스트케이스를 출제하고 AI 정책(모델 고정·질문 횟수·토큰·시스템 프롬프트)을 통제하며,
학생은 제한된 자원 안에서 AI 에이전트를 활용해 코드를 작성·제출하고 Judge0로 자동 채점받는다.

핵심 도메인(향후 `features/`에 구현 — 현재는 초기 세팅 단계):
- **교수**: 문제 출제, AI 에이전트 정책 설정, 응시/채점 관리
- **학생**: 코드 에디터(Monaco), 제한된 AI 대화, 코드 제출·채점 결과 확인
- **채점**: Judge0(Docker, 격리 실행) 연동 자동 채점
- **AI 계층**: 교수 설정 모델·시스템 프롬프트 주입, 질문 횟수·토큰 한도 강제

> 상세 명세는 별도 기획 문서 참조. 본 저장소는 **도메인 비의존 스타터 세팅** 상태입니다.

---

## 빠른 시작

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (Turbopack)
npm run build        # 프로덕션 빌드
npm run typecheck    # 타입 체크 (tsc --noEmit, 빌드 없이)
npm run lint         # ESLint + 레이어 규칙 검사
npm run test         # vitest 실행
# git commit 시 husky가 자동으로 tsc + lint 실행 (lint-staged)
```

- **배포**: 미정 (Judge0는 Docker 기반 별도 배포 필요)
- **기술 스택**: Next.js (App Router) · React 19 · TypeScript · styled-components · Zustand · TanStack Query · MongoDB

---

## 아키텍처

### 디렉토리 구조 (feature-based)

```
src/
├── app/                    Next.js App Router (라우팅만 — 로직 없음)
│
├── features/               도메인별 기능 모듈 (세로 슬라이스)
│   └── {feature}/          View, store, 기능 전용 훅/유틸
│
└── shared/                 공유 레이어 (4개 그룹)
    ├── core/               데이터 & 상태
    │   ├── api/            *Api.ts (데이터 접근 격리 — fetch/DB 호출은 여기에만)
    │   ├── stores/         *Store.ts (Zustand — 클라이언트/UI 상태)
    │   ├── queries/        *Queries.ts (TanStack Query 훅 + queryKeys)
    │   ├── types/          공유 타입 (단일 출처)
    │   └── constants/      상수, 테마 토큰
    ├── lib/                재사용 로직
    │   ├── db/             mongodb.ts (연결 싱글턴)
    │   ├── utils/          logger, 파서 등
    │   └── hooks/          범용 훅
    ├── components/         모든 UI 컴포넌트
    │   ├── ui/             기본 UI (Button 등)
    │   └── providers/      AppProviders, ThemeProvider, QueryProvider, styled 레지스트리
    └── reader/             앱 진입점 오케스트레이터 (features 의존 허용 — 유일한 예외)
```

### 레이어 규칙 (단방향 의존 — 이 프로젝트의 핵심)

```
features/ → shared/*            (가능)
shared/   → features/           (금지 — 레이어 위반, 단 shared/reader는 예외)
features/A → features/B         (금지 — 기능 간 직접 참조)
```

| 레이어 | 위치 | import 가능 대상 |
|---|---|---|
| features | `src/features/*` | shared/core, shared/lib, shared/components |
| shared/components | `src/shared/components/*` | shared/core, shared/lib |
| shared/lib | `src/shared/lib/*` | shared/core, 외부 라이브러리 |
| shared/core | `src/shared/core/*` | 외부 라이브러리만 (core 내부 간 참조 허용) |
| shared/reader | `src/shared/reader/*` | 앱 진입점 — features 의존 허용 (유일한 예외) |

> ⚠️ 이 규칙은 `eslint.config.mjs`의 `import/no-restricted-paths`로 **빌드에서 강제**됩니다.
> `src/shared/`의 아무 파일에서 `@/features/...`를 import하면 lint 에러가 나야 정상입니다.

**위반 패턴 (절대 금지) → 의존성 역전(DI)으로 해결:**
```tsx
// ❌ shared 컴포넌트에서 feature store import
import { useFeatureStore } from '@/features/x/xStore';

// ✅ props/render prop으로 주입
interface ListProps {
  items: Item[];
  onItemSelect?: (id: string) => void;
}
```

---

## 상태 관리 — 서버 상태 vs 클라이언트 상태 (반드시 구분)

| 상태 종류 | 도구 | 위치 |
|---|---|---|
| **서버 데이터** (fetch/cache/동기화/재요청) | **TanStack Query** | `shared/core/queries/` |
| **클라이언트·UI 상태** (모달, 설정, 세션, 선택값) | **Zustand** | `shared/core/stores/` |

**규칙**
- 서버 응답을 Zustand에 **복사 저장 금지** (Query 캐시가 단일 출처)
- 데이터 호출은 `*Api.ts`에만. 컴포넌트는 Query 훅만 사용
- Query key는 배열 팩토리로 중앙화: `queryKeys.{domain}.detail(id)` (`shared/core/queries/queryKeys.ts`)
- MongoDB는 **연결 싱글턴**(`shared/lib/db/mongodb.ts`)으로 dev hot-reload 커넥션 누수 방지

### Zustand persist 규칙
- store별 **고유 persist key** (`'despy-{domain}'`)
- persist 스키마 변경 시 `version` 번호 올리고 `migrate()` 작성 **필수** (안 하면 기존 사용자 앱 깨짐)

---

## 코드 컨벤션 (상세: `docs/conventions.md`)

### 파일 상단 JSDoc (모든 파일 필수)
```typescript
/**
 * 파일명.ts — 한줄 요약
 *
 * 상세 설명 (무엇을, 왜, 어떻게)
 *
 * 사용처: 어디에서 사용되는지
 */
```

### 파일 내 레이어 순서
| 파일 타입 | 순서 |
|---|---|
| 컴포넌트 | Imports → Constants → Types → Component 함수 → Styled Components |
| 훅 | Types → Hook 함수 (Refs → State → Callbacks → Effects → Return) |
| Store | Types → 초기 상태 → Store 정의 → Selector 헬퍼 |

### 네이밍 — 이름만으로 역할 파악 (길고 명확 > 짧고 모호)
```tsx
// boolean: is / should / has 접두사 + 주어 명시
isScrollFocused        // ✅    isActive (❌ 모호)
// 콜백: on + 명사 + 동사
onItemSelectRequest    // ✅    onSelect (❌ 무엇의?)
```

### 금지 사항
- `any` 타입 금지 · 인라인 스타일 지양 · 하드코딩 색상 금지(테마 사용)
- `console.log` 커밋 금지(`logger` 사용) · 기존 주석 삭제/축약 금지

---

## 의사결정 체크포인트 (작업 중 판단 기준)

### 반드시 멈추고 물어볼 것 (Blocking)
아키텍처 변경 · 새 라이브러리 도입 · 데이터 모델/persist 스키마 변경 · 레이어 규칙 예외 · 폴더 구조 변경 · Breaking Change · UX 변경
→ **코드 작성 전** 선택지(장단점·영향 범위·예시)를 제시하고 승인받기.

### 멈추지 않고 진행할 것 (Autonomous)
버그 수정 · 타입 에러 해결 · 컨벤션 정리 · 기존 패턴과 동일한 코드 추가 · import 경로/리네이밍 전파.

### 언급만 하고 진행할 것 (Inform)
성능 영향 선택(memo 등) · 여러 방법 중 선택 시 근거 · 예상보다 영향 범위가 클 때.

---

## 문서 동기화 규칙 (코드 수정 후 필수)

코드를 수정하면 관련 문서를 확인하고 불일치 시 즉시 업데이트한다.

| 수정한 코드 | 확인할 문서 |
|---|---|
| `features/*` 추가/삭제/이동 | CLAUDE.md 디렉토리 구조 |
| store/query 추가/변경 | CLAUDE.md persist key·queryKeys |
| 파일/컴포넌트명 변경 | CLAUDE.md + 관련 문서 |
| 레이어 import 패턴 변경 | CLAUDE.md 레이어 규칙 |

**작업 완료 체크리스트**
```
□ npm run typecheck (tsc --noEmit) 통과
□ npm run lint 통과 (레이어 규칙 포함)
□ 위 매핑 테이블에서 해당 문서 확인·업데이트
□ 구조/타입/규칙 변경 시 CLAUDE.md 갱신
```

---

## 커밋 컨벤션

> git 명령 실행은 유저가 직접 한다. AI는 커밋 메시지 초안만 제시.

```
<type>(<scope>): <subject>

<body>  ← 선택, 왜 변경했는지
```
type: `feat` · `fix` · `refactor` · `docs` · `style` · `chore`
scope: 변경된 feature 또는 shared 레이어명
