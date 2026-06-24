# despy 아키텍처 & 구현 문서 (MVP)

이 문서는 **구현된 MVP가 실제로 어떻게 동작하는지**를 사람이 읽기 위한 설명서다.
요청/응답 계약, 데이터 흐름, 상태 관리, 한계를 담는다.

> ⚠️ **갱신(P5, 2026-06-24) — 채점 채널 변경**: 알고리즘 채점이 **Judge0 실행 채점에서
> AI 정성 채점으로 교체**되었다. `/api/judge`·`JUDGE0_URL`·`docker-compose.judge0.yml`은
> **제거**되었고, 제출은 `POST /api/grade/algorithm`(코드를 실행하지 않고 테스트케이스 기준으로
> AI가 정답성 판정)으로 채점된다. 아래 본문의 Judge0 관련 서술(§3.2·환경변수·데이터 흐름)은
> **피벗 전 기록**이며, 현재 동작은 이 배너와 [`CLAUDE.md`](../CLAUDE.md)·
> [`docs/spec-webcontainer.md`](./spec-webcontainer.md)를 기준으로 한다. 실무형 웹 과제는
> 브라우저 내 WebContainer에서 실행하고 `/api/grade`(루브릭 채점)로 채점한다.

> 문서 지도
> - [`CLAUDE.md`](../CLAUDE.md) — AI 에이전트용 프로젝트 지도(레이어 규칙·컨벤션 요약)
> - [`docs/conventions.md`](./conventions.md) — 코딩 컨벤션 상세
> - [`docs/spec-webcontainer.md`](./spec-webcontainer.md) — WebContainer 피벗 명세(현행 방향)
> - **이 문서** — MVP 동작 원리 & 구현 walkthrough (피벗 전 기록, 채점 채널은 위 배너 참조)

---

## 1. 한눈에 보기

despy는 학생이 **통제된 AI**의 도움을 받아 알고리즘 문제를 풀고, 제출 코드를
자동 채점받는 웹앱이다. 교수는 문제와 AI 정책(모델 고정·질문/토큰 한도·시스템
프롬프트)을 출제한다.

**백엔드는 두 개의 Next.js Route Handler뿐**이다. 목적은 (1) API 키 은닉,
(2) 시스템 프롬프트 주입, (3) Judge0 프록시(CORS 회피). 그 외 모든 상태는
브라우저(localStorage)에 있다.

```
                         ┌──────────────────────── 브라우저 (Next.js 클라이언트) ───────────────────────┐
                         │                                                                              │
   교수 ── /author ──────┤  AuthorView ── problemStore (localStorage 'despy-problems')                  │
                         │                      │                                                       │
                         │                      ▼ (같은 출처를 읽음)                                     │
   학생 ── /solve/[id] ──┤  SolveView ── solveSessionStore (localStorage 'despy-solve-session')         │
                         │     │  │  └─ 코드/언어/AI사용량(문제별)                                        │
                         │     │  │                                                                      │
                         │     │  └──── AI 채팅(useChat) ───────────┐                                    │
                         │     └──────── 제출(useMutation) ──────┐  │                                    │
                         └──────────────────────────────────────┼──┼────────────────────────────────────┘
                                                                 │  │
                                          POST /api/judge ◄──────┘  └──────► POST /api/agent
                                          (Route Handler)                    (Route Handler)
                                                 │                                  │
                                  JUDGE0_URL? ───┤                                  │ GEMINI_API_KEY
                                   ├─ 있음 ──► Judge0 (Docker)                       ▼
                                   └─ 없음 ──► 모의 채점                          Google Gemini API
```

핵심: **시스템 프롬프트·모델·키는 서버 라우트가 주입**하고, **남은 질문/토큰
한도는 클라이언트가 표시·차감**한다.

---

## 2. 사용자 플로우

| 경로 | 화면 | 파일 |
|---|---|---|
| `/` | 홈 — 교수 모드 진입 + 문제 목록(풀기) | [`app/page.tsx`](../src/app/page.tsx) |
| `/author` | 교수 — 문제/AI정책 출제·편집 | [`features/author/AuthorView.tsx`](../src/features/author/AuthorView.tsx) |
| `/solve/[problemId]` | 학생 — 지문·에디터·AI·채점 | [`features/solve/SolveView.tsx`](../src/features/solve/SolveView.tsx) |

**교수 플로우**: 새 문제 → 지문·입출력·제한·허용 언어·테스트 케이스(공개/비공개)
·AI 정책 입력 → 저장(`problemStore`) → "풀기"로 학생 화면 이동.

**학생 플로우**: 문제 선택 → 좌(지문)·중(AI 도우미, 주역)·우(Monaco 에디터 +
예제 실행/제출 + 채점 결과) 3열. "바이브 코딩"을 시험하는 목적상 AI 채팅을
가운데에 크게 두고, **AI가 작성한 코드는 우측 에디터로 실시간 흘러간다**(§4.5).
AI에 질문하면 남은 횟수/토큰이 줄고, 소진되면 입력이 막힌다. 제출하면 Judge0
(또는 모의)가 채점한다.

---

## 3. 백엔드 계약 (Route Handlers)

### 3.1 `POST /api/agent` — AI 프록시 (Gemini)

[`app/api/agent/route.ts`](../src/app/api/agent/route.ts)

**요청 본문** (클라이언트 `useChat` transport가 전송)
```jsonc
{
  "messages": [ /* UIMessage[] — 대화 내역 (AI SDK 포맷) */ ],
  "systemPrompt": "교수가 설정한 답변 가드레일",
  "model": "gemini-2.5-flash",   // 고정 모델
  "maxOutputTokens": 2048         // 응답 1턴 출력 상한
}
```

**처리**
1. `GEMINI_API_KEY`(또는 `GOOGLE_GENERATIVE_AI_API_KEY`) 확인 → 없으면 `500` + 안내 텍스트.
2. `createGoogleGenerativeAI({ apiKey })`로 키 주입, `streamText({ model, system, messages })`.
3. `toUIMessageStreamResponse()`로 스트리밍 응답. 종료 시 `messageMetadata`에
   토큰 usage를 실어 보낸다:
   ```ts
   { inputTokens, outputTokens, totalTokens } // = AgentUsageMetadata
   ```

**응답**: AI SDK UI 메시지 스트림. 클라이언트는 `onFinish`에서
`message.metadata.totalTokens`를 읽어 사용량을 차감한다.

### 3.2 `POST /api/judge` — 채점 프록시 (Judge0 + 모의)

[`app/api/judge/route.ts`](../src/app/api/judge/route.ts)

**요청 본문** (`GradingRequest`)
```jsonc
{
  "problemId": "sample-two-sum",
  "languageId": "python",
  "judge0LanguageId": 71,
  "sourceCode": "...",
  "timeLimitSec": 2,
  "memoryLimitMb": 256,
  "testCases": [ { "id", "input", "expectedOutput", "isPublic" } ]
}
```

**처리 분기**
- `JUDGE0_URL` **있음** → 배치 제출(`POST /submissions/batch`) → 토큰 폴링 →
  `status.id` 매핑(`3=통과·4=실패·5=시간초과·그외=오류`). `JUDGE0_AUTH_TOKEN`이
  있으면 `X-Auth-Token` 헤더로 전달.
- `JUDGE0_URL` **없음** → **모의 채점**: 코드가 있으면 전부 통과, 비어 있으면 오류.
  결과에 `isMock: true`.

**응답** (`GradingResult`)
```jsonc
{
  "problemId", "languageId",
  "totalCount", "passedCount",
  "caseResults": [ { "testCaseId", "isPublic", "status", "timeSec", "memoryKb",
                     /* 공개 케이스만: */ "input", "expectedOutput", "actualOutput", "stderr" } ],
  "isMock": true|false,
  "submittedAt": 1700000000000
}
```

> **비공개 케이스 보호**: `isPublic: false`면 입력/기대/실제 출력을 응답에서
> 생략하고 상태(통과/실패)만 돌려준다.

---

## 4. AI 한도(쿼터) 동작 시퀀스

```
학생 입력 → [전송 가능?] 남은질문>0 && 남은토큰>0 && 스트리밍중 아님
   │ 예
   ▼
sendMessage({text}, {body:{systemPrompt, model, maxOutputTokens}})
   │
   ▼  /api/agent 스트리밍 응답
응답 종료(onFinish) → message.metadata.totalTokens
   │
   ▼
recordAiTurn(problemId, totalTokens)  ──► questionsUsed += 1, tokensUsed += total
   │
   ▼
남은 질문/토큰 게이지 갱신 → 0 이하이면 입력창 비활성화
```

- 한도 정의: 문제의 `aiPolicy.maxQuestions`, `aiPolicy.maxTokens`.
- 차감 위치: [`solveSessionStore`](../src/shared/core/stores/solveSessionStore.ts)`.recordAiTurn`.
- 표시: [`QuotaMeter`](../src/shared/components/ui/QuotaMeter.tsx) (70% 경고색 / 90% 위험색).

> ⚠️ **한계**: 무인증·무서버세션 MVP라 한도 강제는 **클라이언트(UX) 수준**이다.
> 서버는 출력 토큰 상한(`maxOutputTokens`)만 강제한다. 변조 불가능한 쿼터는
> 서버 세션(예: Redis)이 필요하며 MVP 범위 밖이다.

---

## 4.5 실시간 코드 미러링 (AI 직접 편집)

클로드처럼 **AI가 작성한 코드가 에디터로 실시간 흘러들어간다.** 별도 구조화/툴
없이 **채팅 답변의 코드 펜스(```)를 텍스트 스트리밍 그대로 추출**해 미러링하므로
토큰 단위로 타이핑되듯 들어온다.

```
AI 답변 스트리밍(매 청크) → AiChatPanel: 마지막 assistant 메시지 텍스트
   │
   ▼  extractStreamingCodeBlock(text)  (shared/lib/utils/markdownCode.ts)
코드 블록 있음?
   ├─ 첫 감지(메시지당 1회) → onAiCodeStreamStart() → 현재 코드 스냅샷 + 에디터 read-only
   ▼
onAiCodeStream(code) → solveSessionStore.setCode → Monaco value 갱신(실시간)
   │
   ▼  onFinish
onAiCodeStreamEnd() → read-only 해제.  [되돌리기]로 스냅샷 복원 가능.
```

- **토글**: AI 패널의 "AI 직접 편집" 체크박스(`isDirectEditEnabled`). 끄면 코드는
  채팅에만 남고 에디터는 건드리지 않는다.
- **보호장치**: AI 작성 중 에디터는 read-only(충돌 방지), 작성 직전 코드를 스냅샷해
  [되돌리기] 한 번으로 복원. (학생 코드를 덮어쓰되 되돌릴 수 있음)
- **추출 규칙**: 마지막 ``` 블록의 코드. 펜스 미닫힘(작성 중)이어도 현재까지 반환.
  단위 테스트: [`markdownCode.test.ts`](../src/shared/lib/utils/markdownCode.test.ts).
- **설계 메모**: 텍스트 스트리밍을 고른 이유는 Gemini가 툴 인자를 한 번에 반환할 수
  있어 "실시간 타이핑" 효과가 약해질 위험을 피하기 위함. 또한 코드 생성도 동일한
  토큰/질문 한도를 소비하며, AI가 코드를 얼마나 줄지는 **교수 시스템 프롬프트**가
  여전히 통제한다(기능은 열고 정책으로 제어).

---

## 5. 채점 동작 시퀀스

```
제출/예제실행 → useGradeSubmission.mutate(GradingRequest)
   │                       (예제실행은 공개 케이스만, 제출은 전체)
   ▼  POST /api/judge
[JUDGE0_URL?]
   ├─ 있음 → Judge0 배치 제출 → 폴링(최대 20회×0.7s) → status 매핑
   └─ 없음 → 모의 결과(isMock:true)
   │
   ▼
GradingResult → GradingResultPanel (통과수, 모의 배지, 케이스별 상태/출력)
```

파일: [`judgeApi`](../src/shared/core/api/judgeApi.ts) →
[`judgeQueries`](../src/shared/core/queries/judgeQueries.ts) →
[`GradingResultPanel`](../src/features/solve/components/GradingResultPanel.tsx).

---

## 6. 데이터 모델

[`shared/core/types/index.ts`](../src/shared/core/types/index.ts) 단일 출처.

| 타입 | 핵심 필드 | 비고 |
|---|---|---|
| `Problem` | `title, statement, inputFormat, outputFormat, timeLimitSec, memoryLimitMb, allowedLanguageIds, testCases, aiPolicy` | 교수 출제 단위 |
| `AiPolicy` | `model, maxQuestions, maxTokens, systemPrompt` | 문제별 AI 통제 |
| `TestCase` | `input, expectedOutput, isPublic` | 비공개는 학생에 가림 |
| `GradingRequest` | `judge0LanguageId, sourceCode, testCases, …` | 클라 → /api/judge |
| `GradingResult` / `TestCaseResult` | `passedCount/totalCount, caseResults[], isMock` | 채점 결과 |
| `AgentUsageMetadata` | `inputTokens, outputTokens, totalTokens` | AI 응답 usage |

지원 언어/Judge0 id 매핑: [`constants/languages.ts`](../src/shared/core/constants/languages.ts)
(python=71, javascript=63, cpp=54, java=62).

---

## 7. 상태 관리 맵

| 무엇 | 도구 | 위치 | 비고 |
|---|---|---|---|
| 문제·AI정책 | Zustand persist | `problemStore` (`despy-problems` v1) | localStorage, 시드 샘플 포함 |
| 풀이 세션(코드·언어·AI사용량) | Zustand persist | `solveSessionStore` (`despy-solve-session` v1) | 문제별 |
| 채점 요청 | TanStack Query **mutation** | `judgeQueries` | 부수효과 1회성 → queryKey 불필요 |
| AI 채팅 | AI SDK `useChat` | `AiChatPanel` | transport가 `/api/agent` 호출 |

> persist 스토어를 읽는 화면은 [`useHasMounted`](../src/shared/lib/hooks/useHasMounted.ts)로
> 마운트 이후 렌더해 hydration mismatch를 피한다.

---

## 8. 디렉토리 → 책임 맵

```
app/
  page.tsx                     홈(역할 진입 + 문제 목록)
  author/page.tsx              교수 화면 진입점
  solve/[problemId]/page.tsx   학생 화면 진입점
  api/agent/route.ts           AI 프록시 (Gemini)
  api/judge/route.ts           채점 프록시 (Judge0 + 모의)

features/
  author/  AuthorView · ProblemForm · TestCaseEditor · AiPolicyFields · useProblemDraft
  solve/   SolveView · ProblemPanel · CodeEditorPanel · AiChatPanel · GradingResultPanel

shared/
  core/api        judgeApi
  core/stores     problemStore · solveSessionStore
  core/queries    judgeQueries · queryKeys
  core/types      도메인 타입
  core/constants  theme · languages · aiPolicy · sampleProblems
  lib/utils       logger
  lib/hooks       useHasMounted
  components/ui   Button · Panel · Badge · Markdown · QuotaMeter · Field · PageShell
  components/providers  AppProviders · Theme · Query · styled 레지스트리
```

> 레이어 규칙: `features → shared`만 허용. `shared → features` 금지(ESLint 강제).
> 그래서 공유 컴포넌트는 props/콜백으로 의존성을 **주입(DI)** 받는다.

---

## 9. 실행 & 환경 변수

```bash
npm install
cp .env.example .env.local      # GEMINI_API_KEY 입력 (필수: AI 사용 시)
npm run dev                      # 채점은 키 없이도 모의로 동작
```

| 환경 변수 | 필수 | 용도 |
|---|---|---|
| `GEMINI_API_KEY` | AI 사용 시 | Gemini 키(서버 전용). 대안: `GOOGLE_GENERATIVE_AI_API_KEY` |
| `JUDGE0_URL` | 선택 | 없으면 모의 채점. 있으면 실제 Judge0 ([docs/judge0.md](./judge0.md)) |
| `JUDGE0_AUTH_TOKEN` | 선택 | Judge0 인증 토큰 |

기본 모델은 `gemini-2.5-flash`(교수 폼에서 변경 가능,
[constants/aiPolicy.ts](../src/shared/core/constants/aiPolicy.ts)).

---

## 10. MVP 한계와 다음 단계

**의도적으로 제외(범위 밖)**
- 로그인/회원가입/권한 분리, 다중 사용자 동시성.
- 서버측 영속(DB) — 데이터는 localStorage. 다른 기기/브라우저 간 공유 안 됨.

**MVP의 구조적 한계**
- 시스템 프롬프트 비밀성·질문/토큰 한도는 **UX 수준**(클라이언트 저장/차감).
  변조 불가능한 보안 수준 아님 — 서버 세션 도입 시 해결 가능.
- Judge0는 Apple Silicon(macOS)에서 불안정할 수 있음 → 개발 중 모의 채점 권장.

**다음 단계 후보**
- 교수↔학생 라우트 구분 및 진입 동선 정리.
- AI 채팅 기록 persist(현재 새로고침 시 초기화, 사용량 카운터는 유지).
- 제출 전 토큰 사전 카운팅, Judge0 base64 모드 옵션.
- (확정 시) 서버 세션/DB 도입으로 한도·비밀성 강제 — **Blocking 결정**(논의 필요).
```
