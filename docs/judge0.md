# Judge0 로컬 채점 셋업 가이드

despy의 코드 채점은 [Judge0](https://github.com/judge0/judge0)(격리 실행 채점 엔진)을
경유한다. 브라우저가 직접 Judge0를 부르지 않고 우리 서버 라우트
[/api/judge](../src/app/api/judge/route.ts)가 프록시한다(CORS 회피 + 토큰 은닉).

> **요약**: Judge0 없이도 앱은 **모의(mock) 채점**으로 바로 동작한다.
> 실제 채점이 필요할 때만 아래 절차로 로컬 Judge0를 띄우고 `JUDGE0_URL`을 넣으면 된다.

---

## 0. Judge0가 무엇인가 (1분 설명)

- 제출된 소스코드를 **격리된 컨테이너에서 컴파일·실행**하고, 입력(stdin)에 대한
  출력(stdout)을 기대 출력과 비교해 통과/실패를 돌려주는 오픈소스 채점 엔진.
- REST API 서버 + 워커 + PostgreSQL + Redis로 구성되며, **Docker**로 띄운다.
- 60개 이상 언어를 지원하고 언어마다 `language_id`가 있다(우리는
  [languages.ts](../src/shared/core/constants/languages.ts)에 매핑해 둠).

---

## 1. 모의 채점 모드 (기본값 — 셋업 불필요)

`.env.local`에 `JUDGE0_URL`이 없으면 [/api/judge](../src/app/api/judge/route.ts)는
실제 실행 대신 **모의 결과**를 반환한다:

- 코드가 비어 있지 않으면 모든 케이스를 "통과"로, 비어 있으면 "오류"로 표시.
- 결과 패널에 **`모의 채점 (실제 실행 아님)`** 배지가 뜬다.

UI/플로우(제출 → 결과 표시)를 먼저 확인하고 싶을 때 이 모드로 충분하다.

---

## 2. 실제 Judge0 로컬 실행 (Docker)

### 준비물
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 및 실행.

### 절차

```bash
# 1) Judge0 스택 기동 (이 저장소에 포함된 compose 사용)
docker compose -f docker-compose.judge0.yml up -d

# 2) 기동 확인 (서버가 뜨기까지 10~30초 걸릴 수 있음)
curl http://localhost:2358/about
#   → {"version":"1.13.1", ...} 같은 JSON이 나오면 성공

# 3) despy가 실제 채점을 쓰도록 전환
echo 'JUDGE0_URL="http://localhost:2358"' >> .env.local

# 4) despy 개발 서버 재시작
npm run dev
```

이제 풀이 화면에서 **제출**하면 Judge0가 실제로 코드를 실행해 채점한다.
(모의 채점 배지가 사라진다.)

### 끄기

```bash
docker compose -f docker-compose.judge0.yml down
# 데이터까지 삭제하려면:
docker compose -f docker-compose.judge0.yml down -v
```

---

## 3. ⚠️ Apple Silicon(macOS) 주의

Judge0는 채점 격리를 위해 **privileged 컨테이너 + cgroup 접근**이 필요하다.
이 요건은 Linux에서 자연스럽지만, **Apple Silicon Mac의 Docker Desktop(가상 머신
기반)에서는 워커가 정상 동작하지 않는 경우가 많다** (제출이 큐에 멈추거나
internal error). 알려진 회피책:

- **개발 중에는 모의 채점을 사용**하고, 실제 채점은 아래 환경에서 검증:
  - Linux 호스트(또는 Linux VM),
  - 클라우드 VM(EC2 등)에 Judge0를 올리고 `JUDGE0_URL`을 그 주소로 지정,
  - 또는 팀이 공유하는 Judge0 인스턴스.
- 클라우드 셋업은 Judge0 공식 문서를 따른다:
  <https://github.com/judge0/judge0/blob/master/CHANGELOG.md> 및
  배포 가이드 참고.

> Judge0 v1.13.x는 호스트 cgroup v1을 요구하는 구성이 있다. 최신 리눅스 배포판
> (cgroup v2 기본)에서는 커널 파라미터 조정이 필요할 수 있다(공식 문서 참조).

---

## 4. 인증 토큰 (선택)

Judge0에 인증 토큰을 설정했다면 `.env.local`에 함께 넣는다. 라우트가
`X-Auth-Token` 헤더로 전달한다.

```bash
JUDGE0_AUTH_TOKEN="<your-token>"
```

---

## 5. 동작 원리 (참고)

[/api/judge](../src/app/api/judge/route.ts)는 다음을 수행한다:

1. 테스트 케이스들을 Judge0 **배치 제출**(`POST /submissions/batch`)로 보낸다.
   각 케이스에 `source_code`, `language_id`, `stdin`, `expected_output`,
   `cpu_time_limit`, `memory_limit`를 함께 보낸다.
2. 토큰으로 **폴링**(`GET /submissions/batch?tokens=...`)하여 모든 채점이 끝날
   때까지 기다린다.
3. Judge0 `status.id`를 우리 상태로 매핑한다:
   `3=통과 · 4=실패 · 5=시간 초과 · 그 외=오류`.
4. 비공개 테스트 케이스는 입력/기대/실제 출력을 가려서 반환한다.
