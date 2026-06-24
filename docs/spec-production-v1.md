# despy 실서비스 전환 요구 명세서 (Production v1 SRS)

> 작성일: 2026-06-25 · 상태: **진행 중 — 1단계(인증·DB 토대) 구현 완료**
> 목적: 현재 MVP(무서버 세션·localStorage·인증 없음)를 **실제 운영 가능한 서비스**로 전환하기 위한
> 요구사항을 정의한다. 핵심 축은 ① **인증**, ② **인가(교수 접근 관리)**,
> ③ **데이터 영속화(DB 도입)**, ④ **멀티유저/동시성·채점 무결성**이다.
>
> ✅ **1단계 구현 완료(2026-06-25)**: 이메일/비번 + JWT 인증, MongoDB 사용자 영속, 역할 RBAC.
> 구현 이력은 [implementation-log-auth.md](./implementation-log-auth.md). 세종대 연동은 보류(§6).
>
> ⚠️ 이 문서는 **명세(무엇을·왜)** 이며, 구현(어떻게)은 §11 로드맵과 §12 결정 사항을 따른다.
> 아키텍처·DB·라이브러리·데이터 모델 변경은 CLAUDE.md 기준 **Blocking** — 결정 후 착수한다.

---

## 1. 개요 & 목표

despy는 "학생이 통제된 AI 에이전트를 활용해 문제를 푸는 능력"을 평가하는 웹 서비스다.
MVP는 단일 브라우저에서 동작하는 PoC로, 다음 전제 위에 만들어졌다(현행 한계):

- **인증 없음** — 누구나 교수/학생 화면에 진입 가능.
- **영속이 브라우저 로컬** — 문제·AI정책·풀이·제출이 `localStorage`/`IndexedDB`(Zustand persist)에만 존재.
  기기/브라우저가 바뀌면 데이터 소실. 교수가 낸 문제를 다른 학생이 볼 수 없음.
- **민감정보 클라이언트 노출** — 시스템 프롬프트·비공개 테스트케이스·채점 루브릭·정답이
  클라이언트 저장소에 평문으로 존재 → 변조·열람 가능(MVP가 명시한 "UX 수준" 통제).

### 1.1 실서비스 목표

| # | 목표 | 성공 기준 |
|---|---|---|
| G1 | **신원 인증** | 세종대 구성원만 로그인 가능. 세션 기반 접근 통제. |
| G2 | **교수 접근 관리** | 교수/학생/관리자 역할 분리. 교수만 출제·채점 대시보드 접근. |
| G3 | **중앙 영속화** | 문제·정책·제출·채점이 서버 DB에 저장. 기기 무관 접근. |
| G4 | **멀티유저** | 한 문제를 다수 학생이 동시에 풀이·제출. 교수가 모든 제출 열람. |
| G5 | **민감정보 은닉** | 시스템 프롬프트·비공개 케이스·루브릭·정답은 **서버에만** 존재, 클라이언트 미노출. |
| G6 | **자원 한도 강제** | AI 질문/토큰 한도가 서버에서 강제(클라 우회 불가). |
| G7 | **개인정보·법적 준수** | 세종대 자격증명 비저장, PIPA 준수, 감사 로깅. |

---

## 2. 현행(MVP) ↔ 목표(실서비스) 격차 분석

| 영역 | 현행 MVP | 실서비스 요구 | 격차 |
|---|---|---|---|
| 인증 | 없음 | 세종대 로그인 → 세션 | **신규 구축** |
| 인가 | 없음(역할 무) | 교수/학생/관리자 RBAC | **신규 구축** |
| 저장 | localStorage / IndexedDB | 서버 DB | **마이그레이션** |
| 문제 공유 | 불가(로컬 한정) | 교수 출제 → 학생 전원 조회 | **신규(서버 CRUD)** |
| 제출/채점 보관 | `submissionStore`(localStorage) | DB + 교수 대시보드 | **마이그레이션** |
| 시스템 프롬프트 | 클라 노출 | 서버 보관·주입만 | **이전(서버로)** |
| 비공개 테스트케이스/루브릭 | 클라 노출 | 서버 보관, 채점 시에만 사용 | **이전(서버로)** |
| AI 질문/토큰 한도 | 클라 카운팅(우회 가능) | 서버 카운팅·강제 | **이전(서버로)** |
| 동시성 | 단일 사용자 | 다중 사용자 | **신규** |

> 핵심: MVP의 "클라이언트가 단일 출처"였던 모델을, **민감/공유 데이터는 서버가 단일 출처**로 뒤집는다.
> 기존 Zustand store는 *UI 임시 상태*와 *서버 데이터 캐시(TanStack Query)*로 역할이 분리된다.

---

## 3. 범위 (Scope)

### 3.1 In scope (이번 전환)
- 세종대 로그인 연동 인증 + 세션 관리
- 교수/학생/관리자 역할 및 접근 통제(RBAC)
- DB 도입 및 도메인 데이터(문제/과제/AI정책/제출/채점/AI 대화 사용량) 영속화
- 민감정보 서버 이전(시스템 프롬프트·비공개 케이스·루브릭·정답)
- AI 자원 한도 서버 강제(질문 수·토큰)
- 멀티유저 동시 풀이/제출/조회
- 개인정보·감사 로깅 기본기

### 3.2 Out of scope (차기)
- 실시간 협업/감독(프록터링), 표절 탐지
- 대규모 부하 대비 수평 확장·멀티리전
- 결제/과금, 외부 LMS(무들 등) 연동
- 모바일 네이티브 앱
- WebContainer 외 실제 서버 실행 채점(현 정책: AI 정성 채점 유지)

---

## 4. 이해관계자 & 역할

| 역할 | 권한 요약 |
|---|---|
| **학생(student)** | 로그인 · 공개된 문제/과제 조회 · AI 대화(정책 한도 내) · 코드 작성/제출 · **본인** 채점 결과 조회 |
| **교수(professor)** | 학생 권한 + 문제/과제·AI정책·테스트케이스·루브릭 CRUD · **본인 출제분**의 전체 제출/채점 대시보드 조회 · 재채점 |
| **관리자(admin)** | 전체 사용자/역할 관리 · 교수 승격/회수 · 시스템 설정 · 감사 로그 조회 |

> **권한 원칙**: 신원(누구인가)은 세종대 인증으로 확인하고, **역할(무엇을 할 수 있나)은 despy DB가 결정**한다.
> 세종 오픈소스는 교수/학생을 신뢰성 있게 구분하지 못하므로(§6), 역할 부여는 우리 책임이다.

---

## 5. 기능 요구사항 (Functional Requirements)

### FR-A. 인증 (Authentication)
- **FR-A1** 사용자는 세종대 포털 자격증명으로 로그인한다(§6 상세).
- **FR-A2** 인증 성공 시 despy 자체 **세션(서버 세션 또는 JWT)** 을 발급한다. 이후 요청은 이 세션으로 인가하며, **세종대 자격증명을 재사용하지 않는다.**
- **FR-A3** 세종대 자격증명(ID/PW)은 **절대 저장하지 않는다.** 1회성 검증에만 사용 후 폐기(§8 보안).
- **FR-A4** 최초 로그인 시 despy 사용자 레코드를 생성(학번/사번·이름·학과 등 최소 식별정보 저장, §7).
- **FR-A5** 로그아웃 / 세션 만료(유휴 타임아웃·절대 만료) 처리.
- **FR-A6** 인증 실패(자격증명 오류·세종 서버 장애)에 대한 명확한 사용자 피드백과 재시도 가드.

### FR-B. 인가 / 접근 관리 (Authorization)
- **FR-B1** 모든 보호 라우트/Route Handler는 세션을 검증한다(미인증 → 로그인 리다이렉트/401).
- **FR-B2** 역할 기반 접근(RBAC): `student`/`professor`/`admin`. 교수 전용 라우트(`/author/*`, 채점 대시보드, 출제 API)는 교수·관리자만.
- **FR-B3** **리소스 소유권 검사**: 교수는 **본인이 출제한** 문제/과제와 그 제출만 열람·수정·재채점 가능(타 교수 출제분 차단).
- **FR-B4** 학생은 **공개(배포)된** 문제/과제만 조회 가능. **본인 제출/채점 결과만** 조회 가능.
- **FR-B5** **교수 승격 흐름**: 신규 사용자는 기본 `student`. 교수 권한은 (택1, §12-D)
  - (a) 관리자 수동 승격, (b) 사번/이메일 allowlist 자동 매핑, (c) 초대코드 등록.
- **FR-B6** 권한 위반 시도는 감사 로그에 기록(§8).

### FR-C. 데이터 영속화 (Persistence)
- **FR-C1** 문제(`Problem`)·과제(`ChallengeProblem`)·AI정책(`AiPolicy`)을 서버 DB에 저장하고 교수가 CRUD.
- **FR-C2** 문제/과제는 **게시 상태(draft/published/archived)** 를 가진다. 학생에겐 published만 노출.
- **FR-C3** 풀이 세션(코드·언어·AI 사용량)을 (사용자×문제) 단위로 서버 저장 → 기기 간 이어풀기.
- **FR-C4** 제출(submission)과 채점 결과(grading result)를 서버 저장. 교수 대시보드의 단일 출처.
- **FR-C5** **민감 필드 분리 저장**: `aiPolicy.systemPrompt`, 비공개 `testCase`, `rubric`, `testFiles`는
  학생용 직렬화에서 **제외**하고 서버 채점 경로에서만 접근.
- **FR-C6** Zustand persist(localStorage/IndexedDB)는 **UI 임시상태·오프라인 초안**으로 역할 축소.
  서버 데이터는 TanStack Query 캐시가 단일 출처(CLAUDE.md 상태관리 규칙 유지).

### FR-D. 멀티유저 / 동시성
- **FR-D1** 한 문제를 다수 학생이 동시에 풀이·제출.
- **FR-D2** 교수는 본인 출제분의 모든 학생 제출/채점을 대시보드에서 집계 조회.
- **FR-D3** 동일 사용자 다중 탭/기기 풀이 시 최신성(낙관적 잠금 또는 last-write-wins) 정책 정의(§12).

### FR-E. 채점 무결성 (서버 권위)
- **FR-E1** 공식 점수는 **서버(Route Handler)** 가 산출. 클라이언트가 보낸 점수/자동테스트 결과는 *참고 신호*일 뿐 신뢰하지 않는다(기존 §7.2 원칙 유지·강화).
- **FR-E2** 채점에 쓰이는 비공개 케이스·루브릭·정답·시스템 프롬프트는 **서버 저장본**을 사용(클라 전송분 무시).
- **FR-E3** AI 질문 횟수·토큰 한도는 **서버가 세션×문제 단위로 카운트**하고 초과 시 거부(클라 우회 불가). `/api/agent`가 사용량을 DB에 누적.

### FR-F. 기존 기능 보존
- MVP의 출제(알고리즘/과제)·풀이(에디터·AI 채팅·코드 미러링)·AI 정성 채점 UX는 **동등하게 유지**하되, 데이터 출처만 로컬→서버로 전환한다.

---

## 6. 세종대 로그인 통합 — 조사 결과 & 설계

### 6.1 핵심 결론
- **세종대는 외부 서비스용 공식 OAuth2/OIDC/SSO를 제공하지 않는다.** (확인된 공식 SSO는 세종 내부 포털 전용)
- 따라서 현실적 방법은 **자격증명 중계(credential relay)**: 사용자가 포털 ID/PW를 despy에 입력 →
  despy 서버가 세종 포털 로그인 절차를 **모방하여 대신 로그인 시도** → 성공 여부 + 기본 정보(이름/학과/학번)를 받는다.
- 이 방식은 **비공식**이며, 세종 측 페이지 구조 변경 시 깨질 수 있고, **개인정보/약관/법적 검토가 필요**하다(§8.4).

### 6.2 오픈소스 비교

| 항목 | [iml1111/sejong-univ-auth](https://github.com/iml1111/sejong-univ-auth) | [Chuseok22/sejong-portal-login](https://github.com/Chuseok22/sejong-portal-login) |
|---|---|---|
| 언어/스택 | **Python** | **Java / Spring Boot** (OkHttp+jsoup) |
| 라이선스 | **MIT** | 명시 안 됨(확인 필요) |
| 배포 | PyPI 추정 | Maven (자체 Nexus) |
| 인증 방식 | Manual(자동선택)·PortalSSOToken·DosejongSession·MoodlerSession·ClassicSession | 포털 로그인 단일 |
| 반환 정보 | success/is_auth/code/body(이름·학과·학년·재학상태 등) | major·studentId·name·grade·status·completedSemester |
| 자격증명 저장 | **저장 안 함**(검증용 1회 사용 명시) | 명시 없음(중계 방식) |
| 교수 구분 | 불명확(주로 학생 정보) | 불명확(학생 중심) |

> **공통 한계**: ① 둘 다 **백엔드 라이브러리(Python/Java)** — Node/TS 포팅본 없음.
> ② **교수/학생을 신뢰성 있게 구분하지 못함** → 역할은 despy DB가 책임(§FR-B5).
> ③ 비공식 모방 구현 → 세종 페이지 변경에 취약, 유지보수 부담.

### 6.3 통합 아키텍처 옵션 (despy는 Next.js/Node)

| 옵션 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **(A) TS 자체 포팅** | 세종 로그인 흐름을 Node(`undici`/`fetch`+`cheerio`)로 재구현, Next.js Route Handler(`/api/auth/sejong`)에서 호출 | 단일 런타임·배포 단순·외부 의존 최소 | 세종 흐름 직접 분석·유지보수 부담 |
| **(B) Python 사이드카** | `iml1111/sejong-univ-auth`(MIT)를 얇은 FastAPI 서비스로 감싸 내부망에서 호출 | 검증된 다중 인증 방식 재사용·구현 빠름 | 별도 서비스 운영·배포 복잡도↑(Blocking, 새 서비스) |
| (C) Java 사이드카 | Chuseok22 라이브러리를 Spring 서비스로 | 〃 | 라이선스 미확인·JVM 운영 부담 |

> **권장: (A) TS 자체 포팅**을 1차 후보로, 분석 비용이 크면 **(B) Python 사이드카(MIT 라이브러리)** 로 폴백.
> 단 어느 쪽이든 **세종 인증 로직은 서버에만** 두고, 클라이언트는 ID/PW를 HTTPS로 `/api/auth/*`에만 전송.
> ⚠️ (B)/(C)는 "새 백엔드 서비스 추가" → CLAUDE.md상 **Blocking**(§12-A에서 결정).

### 6.4 인증 플로우(권장안)
```
[학생/교수] 포털 ID/PW 입력
   → POST /api/auth/login (HTTPS, body 비로깅)
   → 서버: 세종 인증(옵션 A/B)로 신원 검증 (자격증명 메모리에서만, 즉시 폐기)
   → 성공: despy users 조회/생성 → role 결정(DB) → despy 세션 발급(HttpOnly·Secure 쿠키 / JWT)
   → 이후 모든 요청은 despy 세션으로 인가 (세종 자격증명 재사용 안 함)
```

### 6.5 교수 인증 보완
세종 오픈소스가 교수를 구분하지 못하므로:
- **학생**: 세종 포털 인증 필수 → 자동 `student`.
- **교수**: 세종 인증으로 신원 확인 후 **DB 역할로 승격**(§FR-B5의 a/b/c 중 택1).
  세종 포털 인증이 교직원에게 동작하지 않는 경우를 대비해 **관리자 발급 교수 계정(자체 비밀번호) 대체 경로**를 옵션으로 둔다(§12-D).

---

## 7. 데이터 모델 (DB 스키마 초안)

> 관계형 기준 초안(엔티티/관계). 실제 DB 선택은 §12-A. 기존 TS 타입(`shared/core/types`)을 최대한 보존하고
> 서버 직렬화 시 민감 필드를 분리한다.

- **users**: `id`(PK) · `sejong_id`(학번/사번, unique) · `name` · `major` · `role`(student|professor|admin) · `created_at` · `last_login_at`
- **problems**: 알고리즘 문제. `id` · `author_id`(FK users) · `status`(draft|published|archived) · `title` · `statement` · `input_format` · `output_format` · `time_limit` · `memory_limit` · `allowed_language_ids`(json) · `created_at`/`updated_at`
  - **test_cases**: `id` · `problem_id`(FK) · `input` · `expected_output` · `is_public` *(민감: 비공개 케이스는 학생 직렬화에서 제외)*
  - **ai_policies**: `id` · `owner_type`(problem|challenge) · `owner_id` · `model` · `max_questions` · `max_tokens` · `system_prompt` *(민감: 학생 미노출)*
- **challenges**: 과제(WebContainer). `id` · `author_id` · `status` · `title` · `statement` · `template`(json) · `locked_paths` · `editable_paths` · `setup/dev/test_command`
  - **challenge_test_files**: `challenge_id` · `files`(json) *(민감: 학생 미노출, 채점 시 주입)*
  - **rubrics** / **rubric_criteria**: 채점 기준·가중치 *(민감)*
- **solve_sessions**: (user×problem/challenge) 풀이 상태. `user_id` · `target_id` · `code`/`files`(json) · `language_id` · `updated_at`
- **agent_usages**: AI 자원 카운팅(서버 권위). `user_id` · `target_id` · `question_count` · `input_tokens` · `output_tokens` · `updated_at`
- **submissions**: `id` · `user_id` · `target_id` · `submitted_code`/`files` · `submitted_at`
- **grading_results**: `submission_id`(FK) · `total_count` · `passed_count` · `case_results`(json) · `final_score` · `feedback` · `graded_at` · `grader_model`
- **audit_logs**: `id` · `actor_id` · `action` · `target` · `ip` · `at` (인증·권한·채점·권한변경 기록)

> **민감 필드 격리 규칙**: `system_prompt`, 비공개 `test_cases`, `rubrics`, `challenge_test_files`는
> 학생용 API 응답 DTO에서 **항상 제외**한다(서버 채점/AI 프록시 경로에서만 접근).

---

## 8. 비기능 요구사항 (Non-Functional)

### 8.1 보안
- 전 구간 HTTPS. 세션 쿠키는 `HttpOnly`·`Secure`·`SameSite`.
- 세종 ID/PW는 **로그·APM·에러리포팅에 절대 기록 금지**, 메모리 외 비저장, 검증 직후 폐기.
- CSRF 방어(상태 변경 요청), 레이트 리밋(로그인·AI 프록시·채점).
- 권한 검사는 **서버에서**(클라 가드는 UX 보조).
- ⚠️ WebContainer용 COOP(`same-origin`)+COEP(`require-corp`) 헤더가 **외부 인증 팝업/iframe/CDN과 충돌** 가능 → 세종 인증을 서버 사이드 처리로 두면 회피됨(클라 팝업 미사용). 새 외부 출처 도입 시 CORP/CORS 재점검.

### 8.2 개인정보 (PIPA)
- 수집 최소화: 신원/역할 판단에 필요한 최소 항목만(이름·학번/사번·학과·역할).
- 수집·이용 동의 고지(최초 로그인), 보관 기간·파기 정책 명시.
- 자격증명 비저장 원칙 사용자 고지.

### 8.3 가용성/성능
- 세종 인증 서버 장애 시 graceful degradation(명확한 안내·재시도).
- AI 프록시/채점 타임아웃·재시도·에러 표준화.

### 8.4 법적/운영 리스크 (중요)
- 비공식 모방 인증은 **세종대 약관/정책 위반 소지** 및 페이지 변경 취약성이 있다.
  → **운영 전 학교 측 협의(공식 인증 제공 가능 여부 문의)** 를 강력 권고. 불가 시 위험을 인지하고 동의 기반으로 진행.
- 오픈소스 라이선스 준수(MIT 고지 포함; Chuseok22는 라이선스 확인 필요).

### 8.5 관측성
- 감사 로그(§7 audit_logs), 인증/채점/권한변경 이벤트 추적, 민감정보 마스킹.

---

## 9. 아키텍처 변경 요약

- **백엔드 확장**(CLAUDE.md 2026-06-24 "백엔드 최소화 해제"와 정합): 인증·세션·DB·서버 권위 채점을 Next.js Route Handler로.
- 신규 API(초안): `/api/auth/login`·`/api/auth/logout`·`/api/auth/session`, `/api/problems`·`/api/challenges`(CRUD), `/api/submissions`, 기존 `/api/agent`·`/api/grade*`는 **세션 검증 + 서버 한도/민감정보 강제**로 강화.
- **상태관리 재정렬**: 서버 데이터 → TanStack Query(신규 `*Api.ts`+queryKeys), Zustand는 UI/초안 전용. (CLAUDE.md 상태 규칙 유지)
- **DB 계층**: `shared/lib/db/`에 선택된 DB 클라이언트 싱글턴(hot-reload 누수 방지). 마이그레이션 도구 도입.

---

## 10. 마이그레이션 전략 (localStorage → 서버)

- 기존 사용자 데이터는 단일 브라우저 로컬에만 존재 → **자동 서버 이관은 비목표**. 대신:
  - (옵션) 최초 로그인 시 로컬 초안(문제/풀이) **수동 가져오기(import)** 1회 제공.
  - persist `version` 상향 + `migrate()` 로 신스키마 호환(CLAUDE.md persist 규칙 준수).
- 서버 DB 도입 후 신규 데이터는 서버가 단일 출처. 로컬 store는 캐시/초안으로 강등.

---

## 11. 단계별 로드맵

| 단계 | 내용 | 산출물 | 상태 |
|---|---|---|---|
| **M0 결정** | §12 항목 확정(DB·인증 방식·교수 승격) | 승인된 결정 기록 | ✅ 완료 |
| **M1 DB 기반** | MongoDB 도입·`users` 스키마·연결 싱글턴(lazy) | `users` 컬렉션 | ✅ 완료 |
| **M2 인증** | 이메일/비번 + JWT(`/api/auth/*`) + 세션 + 비밀번호 해시 | 로그인/가입/로그아웃/세션 | ✅ 완료 |
| **M3 인가** | RBAC·라우트 가드(proxy+핸들러)·교수 승격(관리자) | 역할별 접근 통제 | ✅ 완료 |
| **M4 영속 이전** | 문제/과제/풀이/제출/채점 서버 CRUD + Query 전환 | 멀티유저 데이터 | ⬜ 예정 |
| **M5 무결성** | 민감정보 서버 이전·AI 한도 서버 강제·소유권 검사 | 변조 불가 통제 | ⬜ 예정 |
| **M6 운영** | 감사로그·레이트리밋·PIPA 고지·관측성 | 운영 준비 완료 | ⬜ 예정 |

> M1~M3 구현 이력: [implementation-log-auth.md](./implementation-log-auth.md).

---

## 12. 결정 사항

> CLAUDE.md상 아키텍처·DB·라이브러리·데이터 모델·권한 변경은 **결정 후 착수**. 아래는 1단계 확정 내용.

- **D-A. DB 선택** → ✅ **MongoDB**(Atlas). 사용자 영속에 사용. (클러스터 공유 시 전용 `despy` DB 권장 — 인덱스 충돌 회피.)
- **D-B. 인증 방식** → ✅ **이메일/비밀번호 + JWT**. 세종대 포털 연동은 보류(공식 OAuth 부재·약관/유지보수 리스크, §6).
- **D-C. 세션 메커니즘** → ✅ **Stateless JWT**(`jose`, HttpOnly 쿠키). Auth.js/Lucia 등 별도 인증 프레임워크 미도입.
- **D-D. 교수 승격 방식** → ✅ **관리자 수동 승격** + 최초 관리자 시드 스크립트. (allowlist/초대코드는 후속 선택지로 보류.)
- **D-E. 세종대 공식 협의** → ⏸ 보류(연동 재검토 시 학교 문의 권고).
- **D-F. 호스팅/배포** → ⬜ 미정(세션·DB 운영 환경. JWT+MongoDB는 Vercel 단독 운영 가능).

---

## 13. 부록 — 참고 링크
- 세종대 구성원 인증(Python, MIT): https://github.com/iml1111/sejong-univ-auth
- 세종대 포털 로그인(Java/Spring): https://github.com/Chuseok22/sejong-portal-login
- 관련 정리(velog): https://velog.io/@chuseok22/세종대학교-로그인-자동화-라이브러리-Sejong-Uni-Portal-Login-Service
- 기존 설계 문서: `docs/architecture.md`, `docs/spec-webcontainer.md`, `CLAUDE.md`
