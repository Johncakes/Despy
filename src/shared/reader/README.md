# shared/reader/ — 앱 진입점 오케스트레이터

여러 feature를 조합해 하나의 화면/플로우로 엮는 진입점 계층입니다.

> **유일한 예외**: 이 레이어만 `features/`를 import할 수 있습니다.
> (ESLint `no-restricted-paths`에서 `src/shared/reader/**`는 예외 처리됨)

다른 모든 `shared/*`는 `features/`를 import할 수 없습니다.
