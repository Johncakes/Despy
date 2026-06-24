# despy 명세서 — 백엔드 실시간 바이브코딩 (프론트/백/ML 피벗 확장)

> **상태: 구현됨 (정적 검증 ✅ / 브라우저 실측 대기)**
> 이 문서는 despy를 "프론트 위주 WebContainer 코테"에서 **"프론트 · 백엔드 · 머신러닝을 실시간으로
> 바이브코딩하는 환경"** 으로 확장하는 작업 중 **백엔드 부분**을 정리한 것이다.
> 최종 갱신: 2026-06-25.

> 문서 지도
> - [`CLAUDE.md`](../CLAUDE.md) — AI 에이전트용 프로젝트 지도(레이어 규칙·컨벤션)
> - [`docs/spec-webcontainer.md`](./spec-webcontainer.md) — WebContainer 피벗 전체 명세(프론트 기반)
> - **이 문서** — 백엔드 실시간 실행·관찰성(API/DB) 확장

---

## 1. 목표 / 맥락

기존 WebContainer 피벗은 **프론트엔드**(Vite+React)를 컨테이너에서 실시간으로 굴려 미리보기로
보는 데 초점이 있었다. 방향을 넓혀 **세 가지 도메인을 실시간으로 바이브코딩**하는 환경을 만든다.

| 도메인 | "실시간으로 본다"의 의미 | 상태 |
|---|---|---|
| **프론트엔드** | 컨테이너 dev 서버 → iframe 미리보기 (HMR) | ✅ 기존 |
| **백엔드** | 실제 API 실행 + 입출력·DB 상태를 실시간 관찰 | ✅ 이 문서 |
| **머신러닝** | 신경망 학습/추론을 실시간 시각화 | ⏳ 미착수 (§10) |

백엔드의 핵심 난점은 "프론트는 화면이 보이지만 **API는 무엇을 실시간으로 보여줄 것인가**"였다.
답: **(1) 라이브 요청 콘솔, (2) 요청/응답 실시간 로그, (3) DB 상태 실시간 뷰** 세 가지.

---

## 2. 한눈 요약

| 기능 | 무엇 | 메커니즘 | 상태 |
|---|---|---|---|
| **풀스택 단일 컨테이너** | 한 컨테이너에서 Vite(프론트)+Express(백) 동시 구동 | `concurrently` + Vite proxy(`/api`→:3000) + 멀티포트 미리보기 | ✅ |
| **API 콘솔** | 메서드/경로/바디 → 상태코드+응답 (Postman 라이트) | 요청을 컨테이너 *안에서* node로 실행(CORS/COEP 회피) | ✅ |
| **API 로그** | 백엔드가 처리한 요청/응답 실시간 누적 | 로깅 미들웨어 → stdout 센티넬 → dev 스트림 파싱 | ✅ |
| **DB 상태** | 저장소(`db.json`) 현재 상태 실시간 표 | 파일 백업 db + 호스트 `fs.watch` | ✅ |
| **편집 자동 반영** | 백엔드 코드 수정 시 서버 자동 재시작 | `node --watch` | ✅ (실측 필요) |

**빌드 상태**: `npm run typecheck` ✅ · `npm run lint`(레이어 규칙 포함) ✅ · `npm run test` ✅ (8파일 81테스트).
**검증 한계**: WebContainer 부팅이 필요한 기능이라 정적 검증까지 완료. 실제 부팅·요청·DB 갱신은 브라우저 실측 대기(§9).

---

## 3. 백엔드 실행 모델 — 풀스택 단일 컨테이너

한 WebContainer 안에서 **백(Express :3000)과 프론트(Vite :5173)를 `concurrently`로 동시 구동**하고,
Vite proxy가 프론트의 `/api/*`를 같은 컨테이너의 Express로 전달한다(same-origin — CORS 없음, 실제
배포 구조와 동일). 미리보기 iframe에는 **프론트(Vite)만** 노출하고, 학생이 프론트 UI를 조작하면
그게 자기 백엔드 API를 때려 결과가 실시간으로 화면에 반영된다.

```
WebContainer
 ├─ node --watch server/index.js   → Express  :3000   (학생 라우트 + 로깅 + db)
 └─ vite                           → 프론트   :5173   (미리보기 iframe)
        프론트 fetch('/api/..')  ──Vite proxy──▶  :3000
```

### 3.1 멀티포트 미리보기 확정
두 서버가 각각 `server-ready`(포트별)를 내므로, 미리보기에 백엔드 raw JSON이 아닌 프론트 화면이
꽂히도록 **프론트 포트만 골라 확정**한다.
- `runtime.startDevServer(..., { previewPort })` — 지정 포트의 `server-ready`에서만 resolve.
- `useWorkspace`가 템플릿에서 추론(`vite.config.js`+`server/index.js` 동시 보유 → 풀스택 → `FULLSTACK_PREVIEW_PORT(5173)`).
- persist 스키마(ChallengeProblem) 변경을 피하려고 **템플릿 내용으로만 추론**한다.

### 3.2 백엔드 단독 vs 풀스택
백엔드만 있는 템플릿(Express 단독, `index.html` 없음)은 미리보기가 raw JSON뿐이라 **API 콘솔을 기본
탭**으로 연다(`ApiConsoleConfig.isPrimaryView`). 풀스택은 미리보기(프론트)를 기본 탭으로 둔다.

---

## 4. 백엔드 실시간 관찰성 3종

호스트(despy 페이지)에서 컨테이너 미리보기 URL로 **직접 fetch하면 cross-origin + COEP/CORS에 막힌다.**
그래서 세 기능 모두 **컨테이너 내부의 채널**(node 실행 / stdout / 파일)을 통해 우회한다.

### 4.1 API 콘솔 (`ApiConsole`)
- 메서드(GET·POST·PUT·PATCH·DELETE)·경로·바디를 입력 → `Send`.
- 실행: `runtime.sendHttpRequest` 가 헬퍼 스크립트(`.despy-request.mjs`, 파일트리 밖이라 비표시)를 FS에
  쓰고 env로 메서드/경로/바디/포트를 넘겨 **컨테이너 안 node로 `localhost:3000`에 요청** → stdout
  센티넬 사이 JSON을 파싱해 상태코드·소요시간·응답을 표시.
- 호스트 직접 fetch가 아니라 컨테이너 내부 실행이라 CORS/COEP 무관.

### 4.2 API 로그 (`ApiLogList`)
- 잠긴 서버 진입점(`server/index.js`·`src/server.js`)에 **로깅 미들웨어**(`despyRequestLogger`)를 주입.
  학생 앱을 `app.use(express.json()); app.use(logger); app.use(createApp(db))` 로 감싸, 매 요청의
  `{method, path, status, durationMs, reqBody, resBody}`를 **센티넬 JSON 한 줄**(`__DESPY_LOG__…__DESPY_LOG_END__`)로
  stdout에 출력한다.
- 호스트: `useWorkspace.handleDevOutput`이 dev 출력 스트림에서 그 줄만 골라 구조화(`ApiLogEntry[]`)하고
  나머지 텍스트는 콘솔로 흘린다(청크 경계에 걸친 조각은 버퍼로 이어붙임).
- **콘솔 수동 요청 + 프론트가 보낸 요청 모두** 잡힌다 → 진짜 실시간 입출력 뷰.

### 4.3 DB 상태 (`DbInspector`)
- 저장소가 `createApp(db)`로 **주입**되는 `db` 모듈. dev 서버는 **파일 백업**(`server/data/db.json` ·
  `src/data/db.json`)을, 테스트는 **인메모리**를 주입한다.
- db는 write마다 JSON 파일에 기록 → 호스트가 `runtime.watchContainerFile`(WebContainer `fs.watch`)로
  그 파일을 구독 → 변경 시 파싱해 `dbState` 갱신 → 표로 렌더(객체 배열은 테이블, 스칼라는 키-값).
- 덤: 파일 백업이라 **세션 내 영속**이 생긴다(인메모리 대비 업그레이드).

### 4.4 편집 자동 반영
`node --watch`로 `server/*` 변경 시 서버가 자동 재시작된다(편집 → 즉시 반영). `db.json`은 `import`가
아니라 `fs`로 읽으므로 watch 대상이 아니다 → 쓰기→재시작 루프 없음. 재시작 시 파일 백업 db는 상태를
유지하고, 호스트의 `fs.watch`는 그대로 살아 있다.

---

## 5. 템플릿 구조

백엔드 템플릿 2종(`FULLSTACK_TODO_TEMPLATE` 풀스택 · `EXPRESS_TODO_API_TEMPLATE` 백엔드 단독)이 같은
구조를 공유한다. 풀스택 기준:

```
package.json          dev: concurrently "node --watch server/index.js" "vite"          [잠금]
vite.config.js        port 5173 strictPort + proxy /api → :3000                        [잠금]
vitest.config.js      happy-dom(프론트). 백 테스트는 // @vitest-environment node 도크블록 [잠금]
index.html · src/main.jsx                                                              [잠금]
src/App.jsx           프론트 — fetch('/api/todos') (GET 목록 + POST 추가 폼)        ← 편집(프론트)
src/index.css                                                                          ← 편집(스타일)
server/app.js         createApp(db) — db.todos·db.addTodo 로 라우트 구현             ← 편집(백엔드)
server/db.js          저장소 모듈 — createFileDb(파일)·createMemoryDb(테스트)          [잠금]
server/index.js       파일 db 주입 + 로깅 미들웨어 + listen(3000)                       [잠금]
server/app.test.js    supertest 채점 계약(인메모리 db로 격리)                           [잠금]
server/data/db.json   런타임 생성(파일 백업) — DB 상태 watch 대상
```

- **편집 가능**: `server/app.js`(백 라우트) · `src/App.jsx`(프론트) · `src/index.css`.
- **잠금(무결성)**: 빌드/실행 설정, `server/index.js`(실행 골격+로깅), `server/db.js`(저장소),
  양쪽 채점 계약(`server/app.test.js`·`src/App.test.jsx`).
- 백엔드 단독(`EXPRESS_TODO_API_TEMPLATE`)은 `src/` 레이아웃, 라우트 `/todos`, db 파일 `src/data/db.json`.

### 5.1 db 모듈 인터페이스 (학생 노출 API)
```js
db.todos              // 현재 할 일 목록(읽기)
db.addTodo(title)     // 추가 + 저장, 생성 항목 반환
db.save()             // todos를 직접 수정했을 때 호출(선택)
```
"주어진 저장소를 사용한다"가 과제 계약이다 — 학생이 지역 배열을 직접 만들면 DB 뷰에 안 잡힌다
(오히려 교육적으로 바람직).

---

## 6. 채점 무결성

채점은 실행 기반(`npm test` → supertest로 API HTTP 행동 검증)이라 알고리즘의 AI 정성판정보다 강하다.
- **DI로 테스트 격리**: `createApp(createMemoryDb())` — 각 테스트가 새 인메모리 db로 시작해 상태가
  섞이지 않는다. dev 서버만 파일 백업 db를 쓴다.
- 잠긴 `app.test.js`가 채점 계약(스펙) 역할. 학생은 통과하도록 구현한다(red→green).
- 풀스택은 한 번의 `npm test`로 프론트(happy-dom)·백(node 도크블록+supertest) 두 계층을 함께 검증.

---

## 7. 변경 파일 맵

| 레이어 | 파일 | 변경 |
|---|---|---|
| types | `shared/core/types/index.ts` | `ApiConsoleRequest`·`ApiConsoleResponse`·`ApiConsoleConfig`(+`dbFilePath`)·`ApiLogEntry` |
| runtime | `shared/lib/webcontainer/runtime.ts` | `startDevServer({previewPort})` · `sendHttpRequest` · `readContainerFile`/`watchContainerFile` |
| hook | `features/solve/useWorkspace.ts` | previewPort/apiConsole 추론 · API 로그 파서(`handleDevOutput`) · DB watch 효과 · `apiLogs`·`clearApiLogs`·`dbState`·`sendApiRequest` 노출 |
| 템플릿 | `shared/core/constants/webcontainerTemplates.ts` | `FULLSTACK_TODO_TEMPLATE`·`FULLSTACK_PREVIEW_PORT`. 백엔드 2종에 db 모듈·로깅·`node --watch`·`createApp(db)` DI |
| 샘플 | `shared/core/constants/sampleChallenges.ts` | `sample-fullstack-todo` 추가 · 백엔드 지문을 db API/실시간 탭 기준으로 갱신 |
| store | `shared/core/stores/challengeStore.ts` | persist v2→v3 additive migrate(없는 샘플만 시드 보강) |
| UI | `features/solve/components/` | `ApiConsole`·`ApiLogList`·`DbInspector` 신규 + `WorkspacePanel` 탭(미리보기·API 콘솔·API 로그·DB 상태·콘솔·브라우저·테스트) |

---

## 8. 결정 기록 (Blocking 답변)

| 결정 | 선택 | 근거 |
|---|---|---|
| 백엔드 상호작용 모델 | **풀스택 단일 컨테이너** | 프론트 UX 재사용, 실제 배포 구조와 동일, 새 인프라 0 |
| API 입출력 관찰 | **라이브 요청 콘솔 + 실시간 로그** | iframe은 raw JSON뿐 → 콘솔/로그가 백엔드의 "실시간 미리보기" |
| 데이터 계층 | **인메모리 시작 → 파일 백업 db** | DB 상태 뷰를 위해 공유 가능한 파일로. 세션 영속은 덤 |
| DB 상태 표시 방식 | **파일 백업 + `fs.watch`** | 폴링 없이 실시간, "DB 상태" 멘탈모델과 일치, 영속 |
| 미리보기 포트 전달 | **템플릿 추론(스키마 무변경)** | ChallengeProblem persist 스키마 변경 회피 |

---

## 9. 한계 · 검증 필요

- **`node --watch`**: Node 20+ 표준이지만 WebContainer에서의 동작은 **브라우저 실측 필요**. 만약 백엔드
  dev 서버가 안 뜨면 dev 스크립트에서 `--watch`만 제거하면 된다(그래도 API 로그·DB 뷰는 실행 중 서버
  기준으로 동작, 편집 반영만 수동 재시작 필요).
- **WebContainer 부팅 의존**: cross-origin isolation이 필요해 정적 검증(typecheck/lint/test)까지만 됐다.
  실제 부팅·요청·DB 갱신·로그 스트림은 브라우저에서 확인해야 한다.
- **db 사용 계약**: 학생이 제공된 `db`를 안 쓰고 지역 변수를 쓰면 DB 뷰에 잡히지 않는다(지문에 명시).
- **출제 도구 미연결**: 교수 출제 폼(`ChallengeForm`)의 프리셋은 아직 Vite+React 하나뿐 —
  Express/풀스택 프리셋 선택은 미구현(후속, §10).
- **재진입 strictPort**: 풀스택 재진입 시 Vite 5173 반납 지연 가능성(현재 dev-start 타임아웃 가드 없음).

---

## 10. 후속 (미착수)

- **출제 프리셋 확장**: `ChallengeForm`에 프리셋 선택(Vite+React / Express / 풀스택) 추가 — 템플릿·잠금
  상수는 이미 export되어 배선만 필요.
- **DB 계층 업그레이드**: 필요 시 SQLite-WASM로 전환 — `db.json` 자리에 SQLite 파일을 직접 쿼리해
  테이블 뷰로. `DbInspector` 패널 구조 재사용 가능.
- **머신러닝 실시간 시각화**: 파이썬/네이티브 제약이 백엔드와 완전히 달라(Pyodide·TensorFlow.js 등)
  별도 설계 필요 — 신경망 학습 곡선·레이어 활성 실시간 표시.
- **콘솔 편의**: API 콘솔 요청 히스토리, 헤더 패널, 로그 필터/검색.
