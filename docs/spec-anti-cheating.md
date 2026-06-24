# 부정행위 방지 명세 — despy

> 마지막 업데이트: 2026-06-25

---

## 1. 기본 원칙

> **막는 것(prevention)이 아니라, 탐지·기록하고 사후 판정 가능한 증거를 남긴다(detection + audit).**

어떤 소프트웨어도 두 번째 기기나 물리적 부정행위를 막을 수 없다.
despy는 이미 AI 대화 트랜스크립트·코드 diff 타임라인·AI 사용량을 보관하므로,
이 데이터를 기반으로 **사후 분석** 하는 것이 가장 효과적인 1차 방어선이다.

---

## 2. 구현 현황 (웹, 2026-06-25)

`useProctoringMonitor` 훅(`shared/lib/hooks/useProctoringMonitor.ts`)이 풀이 화면에서 실행된다.

| 항목 | 동작 | 저장 위치 |
|---|---|---|
| **탭 이탈** | `visibilitychange(hidden)` 횟수 + 숨김 누적 시간(ms) 카운트 | `integrityLog.tabSwitchCount / tabSwitchTotalMs` |
| **붙여넣기** | `document paste` 30자 초과 횟수 — 앱 내부 자기복사/외부 유입 구분 불가(약신호) | `integrityLog.externalPasteCount` |
| **전체화면 이탈** | 전체화면 진입 후 나간 횟수 (`fullscreenchange`) — 정상 Esc·F11 오탐 다수라 **참고용(경고 합계 제외)** | `integrityLog.fullscreenExitCount` |
| **전체화면 유도** | 풀이 화면 진입 시 전체화면 권장 배너 표시 | — |
| **실시간 배지** | TopBar에 탭이탈+붙여넣기 합계 ⚠ n 배지(전체화면 이탈 제외) | — |
| **행동 기록 고지** | 풀이 화면 상시 고지(추적·교수 제공 사실) — PIPA 정합 + deterrence | — |

- 알고리즘 풀이(`SolveView`): 실시간 배지만 표시, 세션 내 억제 목적
- 과제 풀이(`ChallengeSolveView`): 제출 시 `integrityLog`를 `submissionStore`에 저장
- 교수 대시보드(`GradingDashboardView`): 제출 목록에 이상행위 횟수 컬럼, 상세 모달 헤더에 상세 내역

### 대시보드 표기 (색상 등급 없음)

이상행위 합계 = 탭이탈 + 붙여넣기(전체화면 이탈 제외). 이 값은 **클라이언트 자기보고값이라
위조·우회 가능**하므로 위험/경고 색상 등급을 매기지 않고 **중립 카운트**로만 표시하고
'자기보고·위조 가능' 캡션을 단다(교수가 검증된 증거로 오인하지 않도록). 단정적 증거가 아니라
프롬프트 타임라인·diff와 **교차검증할 보조 신호**다(§1·§6).

| 합계 | 표시 |
|---|---|
| 0 | — (표시 없음) |
| 1+ | 중립색 숫자 + 자기보고·위조 가능 캡션(툴팁) |

---

## 3. 웹만으로 가능한 것 / 한계

| 위협 | 웹 구현 수준 | 한계 |
|---|---|---|
| 외부 AI (탭 전환) | 이탈 횟수·시간 감지·기록 | 다른 기기로 AI 사용 시 감지 불가 |
| 다중 모니터 | `screen.isExtended` 감지 가능(권한 필요, 거부 시 무력) | 확실한 차단 불가 |
| 복붙 | 30자 초과 붙여넣기 기록, `contextmenu` 비활성화 가능 | 개발자도구로 우회 가능 |
| OBS / 원격제어 | 브라우저에서 탐지 불가 | — |

---

## 4. Electron 앱 추가 시 가능한 것 (예상 기술)

Electron = Chromium + Node.js → OS 레벨 접근 가능.

| 위협 | 기술 | API |
|---|---|---|
| **외부 AI 앱 실행** | 블랙리스트 프로세스 주기 스캔(ChatGPT·Copilot·Discord 등) | `child_process.execSync('ps')` / `tasklist` |
| **원격 제어** | TeamViewer·AnyDesk·Zoom Remote 프로세스 탐지 | 동일 |
| **OBS / 화면 공유** | OBS·가상 카메라 드라이버 프로세스·장치명 탐지 | `desktopCapturer.getSources()` |
| **다중 모니터** | 권한 없이 모니터 개수·배치 확인, 외부 디스플레이 시 차단 | `screen.getAllDisplays()` |
| **OS 클립보드** | 시험 시작 시 클립보드 비우기, 주기적 클리어 | `clipboard.clear()` |
| **키오스크 모드** | Alt+Tab 등 일부 OS 단축키 차단, 항상 최상위 윈도우 | `kiosk: true`, `alwaysOnTop`, `globalShortcut` |
| **창 이탈** | 창 포커스 이탈 이벤트 OS 레벨 감지 | `BrowserWindow 'blur'` |

### Electron 도입 시 고려사항

- **배포 부담**: 학생이 직접 설치파일(`.exe`/`.dmg`) 받아 설치해야 함
- **Mac 코드 서명**: Apple Developer Program 유료 가입($99/년) 없으면 "악성앱" 경고
- **업데이트**: `electron-updater`로 자동 업데이트 구현 필요
- **초기 공수**: 빌드 파이프라인 + 배포 인프라 구성에 1–2주 예상
- **프라이버시·고지 의무**: 프로세스 스캔·클립보드 접근은 민감 정보 수집으로 사전 동의·고지 필수
  → 도입 전 CLAUDE.md「의사결정 체크포인트 — Blocking」 항목으로 논의

---

## 5. 어떤 기술로도 못 막는 것

- 옆에 둔 **휴대폰 / 두 번째 노트북**으로 AI 사용
- **HDMI 캡처보드** 등 하드웨어 화면 추출
- 옆 사람이 불러주기

→ 이 영역은 **대면 시험장 · 웹캠 감독 · 자리 배치**로만 커버 가능. 소프트웨어의 책임 밖.

---

## 6. despy 특이점 — "외부 AI 차단"이 아닌 "채널 통제"

despy의 목표는 AI를 금지하는 것이 아니라 **통제된 AI(despy 내 채팅)만 허용**하는 것이다.
따라서 "외부 AI 금지"는 despy AI 외의 채널(ChatGPT·Claude 등)을 닫는 것이 목표이며,
이미 보유한 **프롬프트 타임라인 + AI 사용량 분석**이 핵심 평가 도구다.

---

## 7. 로드맵

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase 1 (현재) | 탭 이탈·붙여넣기·전체화면 감지·기록 + 대시보드 플래그 | ✅ 구현 완료 |
| Phase 2 (웹 추가) | `screen.isExtended` 다중모니터 감지, `paste` 완전 차단 옵션 | 미구현 |
| Phase 3 (Electron) | 프로세스 스캔·키오스크·클립보드 통제 — 고stakes 시험 전용 | 미구현 (도입 논의 필요) |
