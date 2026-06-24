# 구현 진행 기록 — 인증·DB 토대 (실서비스 전환)

> MVP(무인증·localStorage)를 실서비스로 전환하기 위한 **1단계: 인증·DB 토대** 구현 이력.
> 요구 명세는 [spec-production-v1.md](./spec-production-v1.md), AI 지도는 [CLAUDE.md](../CLAUDE.md).
> WebContainer 피벗 이력은 [implementation-log.md](./implementation-log.md)(별개 이니셔티브).
> **최종 갱신: 2026-06-25**

---

## 한눈 요약

| 항목 | 내용 | 상태 |
|---|---|---|
| 인증 | 이메일/비밀번호 + **JWT 세션**(HttpOnly 쿠키) | ✅ 완료·검증 |
| DB | **MongoDB**(Atlas) `users` 컬렉션 영속 | ✅ 완료·검증 |
| 인가 | 역할 RBAC(student/professor/admin) + 라우트 게이트 | ✅ 완료·검증 |
| 계정/권한 | 자가 가입(기본 student) → **관리자 승격** + 시드 관리자 | ✅ 완료·검증 |
| 세종대 연동 | 비공식 모방·법적 리스크로 **보류** | ⏸ 보류 |

**빌드 상태**: `npm run typecheck` ✅ · `npm run lint`(레이어 규칙 포함) ✅ · `npm run test` ✅ (8파일 81테스트) · `npm run build` ✅.

**확정 결정(사용자)**: ① 세종대 포털 연동은 보류하고 **평범한 이메일/비번 + JWT** 채택. ② DB는 **MongoDB**.
③ 범위는 **인증·DB 토대만**(문제/과제/제출 등 도메인 데이터는 아직 localStorage). ④ **자가 가입 + 관리자 승격**.

---

## 무엇을 만들었나

- **회원가입/로그인/로그아웃/세션 조회** — 이메일·비밀번호, 비밀번호는 bcryptjs 해시로만 저장, 세션은 JWT(HttpOnly·SameSite=Lax·prod Secure 쿠키).
- **역할 기반 접근(RBAC)** — `student`(기본) / `professor`(출제·채점) / `admin`(사용자 관리).
- **페이지 라우트 게이트**(Edge proxy) — 미인증/권한부족 시 리다이렉트.
- **API 가드** — 보호 라우트는 핸들러에서 `requireUser`/`requireRole`로 401/403.
- **관리자 사용자 관리 화면** — 사용자 목록 + 역할 드롭다운 승격(본인 변경 차단).
- **최초 관리자 시드 스크립트** — 자가 가입은 모두 student이므로 첫 admin은 시드로 생성.

---

## 파일 맵

| 영역 | 파일 | 내용 |
|---|---|---|
| 서버·인증 로직 | `src/shared/lib/db/mongodb.ts` | 연결 싱글턴(**lazy** — 호출 시 URI 검사), `getClient`/`getDb` |
| | `src/shared/lib/db/users.ts` | `users` 리포지토리(find/create/updateRole/listUsers/touchLastLogin), `toAuthUser`(passwordHash 제외), email 유니크 인덱스 |
| | `src/shared/lib/auth/password.ts` | bcryptjs 해시/검증 |
| | `src/shared/lib/auth/jwt.ts` | jose 서명/검증(`SESSION_COOKIE` 상수 포함 — Edge 안전) |
| | `src/shared/lib/auth/session.ts` | 쿠키 발급/해제 · `getCurrentUser`/`requireUser`/`requireRole` · `AuthError`/`authErrorToResponse` |
| API | `src/app/api/auth/{signup,login,logout,me}/route.ts` | 인증 엔드포인트 |
| | `src/app/api/admin/users/route.ts` · `.../[userId]/route.ts` | 사용자 목록 · 역할 변경(admin) |
| | `src/app/api/{agent,grade,grade/algorithm}/route.ts` | 기존 라우트에 `requireUser` 가드 추가 |
| 라우트 게이트 | `src/proxy.ts` | Edge 인증/인가 게이트(Next.js 16 `proxy` 컨벤션 — 구 `middleware`) |
| 클라이언트 | `src/shared/core/api/authApi.ts` | fetch 래퍼(signup/login/logout/me·관리자) |
| | `src/shared/core/queries/authQueries.ts` | `useCurrentUser`·login/signup/logout·`useUsers`/`useUpdateUserRole` |
| | `src/shared/core/queries/queryKeys.ts` | `auth.me`·`admin.users` 키 |
| | `src/shared/core/types/index.ts` | `UserRole`·`AuthUser` 타입 |
| 화면 | `src/features/auth/{LoginView,SignupView}.tsx` | 로그인·회원가입 |
| | `src/features/admin/AdminUsersView.tsx` | 사용자/역할 관리 |
| | `src/app/{login,signup,admin/users}/page.tsx` | 진입점(login은 `useSearchParams`라 Suspense) |
| | `src/app/page.tsx` | 홈 헤더 — 로그인 상태·역할별 메뉴 노출 |
| 설정·시드 | `.env.example` · `package.json`(`seed:admin`) · `scripts/seed-admin.ts` | 환경변수·시드 |

---

## 데이터 모델 (`users` 컬렉션)

```ts
interface UserDoc {
  _id: ObjectId;
  email: string;        // 정규화(소문자) 저장, unique 인덱스
  passwordHash: string; // bcryptjs — 응답에 절대 미포함
  name: string;
  role: 'student' | 'professor' | 'admin';
  createdAt: Date;
  lastLoginAt?: Date;
}
```
클라이언트 노출은 항상 `AuthUser`(`id`·`email`·`name`·`role`) — passwordHash 제외.

---

## 로컬 설정 가이드

1. **MongoDB 준비** — MongoDB Atlas 무료(M0) 클러스터 생성 → DB 사용자 + Network Access(테스트는 `0.0.0.0/0`) → 연결 문자열 복사.
2. **`.env.local` 설정** (`.env.example` 참고):
   ```
   MONGODB_URI="mongodb+srv://<user>:<pw>@<cluster>/...."
   MONGODB_DB_NAME="despy"     # 클러스터를 다른 DB와 공유하면 전용 DB명 권장
   JWT_SECRET="<openssl rand -base64 48 결과>"
   ADMIN_SEED_EMAIL="admin@despy.local"
   ADMIN_SEED_PASSWORD="<관리자 비밀번호>"
   ADMIN_SEED_NAME="관리자"
   ```
   > ⚠️ 클러스터를 기존 다른 프로젝트와 공유한다면 **반드시 `MONGODB_DB_NAME`으로 전용 DB**(예: `despy`)를
   > 지정한다. 같은 DB의 `users` 컬렉션에 이미 다른 스키마 데이터가 있으면 email 유니크 인덱스가 충돌한다(실제로 겪음).
3. **관리자 시드** — `npm run seed:admin` (`tsx --env-file=.env.local`로 .env.local 로드. 멱등 — 이미 있으면 역할만 admin으로 승격).
4. **개발 서버** — `npm run dev`. ⚠️ `.env.local` 변경 후에는 **반드시 재시작**(기존 프로세스는 옛 env 보유).

---

## 검증 (수동 e2e — 통과)

브라우저에서 세 시나리오로 검증함:
- **A. 학생 차단** — student로 로그인 시 홈에 교수 버튼 미표시 · `/author`·`/admin/users` 직접 접근 시 홈으로 리다이렉트.
- **B. 승격** — admin 로그인 → `/admin/users`에서 student를 professor로 변경(본인 행은 비활성).
- **C. 반영** — 승격된 계정 **재로그인** 후 교수 버튼 표시 · `/author` 정상 진입.

자동 빌드 검증: typecheck·lint·test(81)·build 모두 통과.

---

## 핵심 결정 / 트레이드오프

- **역할을 JWT에 담음** → 미들웨어가 DB 조회 없이 게이팅(빠름). 대신 **승격은 재로그인 후 반영**(토큰 staleness). 토대 단계에서 수용.
- **`jose` 채택**(JWT) — Edge 런타임(proxy) 호환. `jsonwebtoken`은 Edge 비호환이라 배제.
- **`bcryptjs`**(순수 JS) — 네이티브 빌드 없는 비밀번호 해시.
- **세션 = HttpOnly 쿠키** — 토큰을 JS에서 다루지 않음(XSS 탈취 방어). 자격증명/토큰은 서버에서만.
- **API 가드는 핸들러에서**(401/403 JSON), **페이지 가드는 proxy에서**(리다이렉트) — 역할 분리.
- **민감정보 서버 이전은 다음 단계** — 현재 시스템 프롬프트·비공개 케이스·루브릭·도메인 데이터는 아직 클라(localStorage). 이번 토대는 *인증/사용자*만 서버로.
- **세종대 포털 연동 보류** — 공식 OAuth 부재로 비공식 모방이 필요하고 약관·유지보수 리스크가 큼([spec-production-v1.md](./spec-production-v1.md) §6).

---

## 다음 단계 (범위 밖 — 후속)

- 문제·과제·풀이·제출·채점 데이터의 **MongoDB 이전** + 서버 CRUD(교수 출제 → 학생 전원 조회).
- **AI 질문·토큰 한도 서버 강제** + 시스템 프롬프트·비공개 케이스·루브릭의 서버 이전(변조 불가 통제).
- 리소스 소유권 검사(교수는 본인 출제분만), 감사 로깅, 레이트 리밋.
- (선택) 비밀번호 재설정·이메일 인증·세종대 연동 재검토.
