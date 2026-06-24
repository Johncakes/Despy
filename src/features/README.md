# features/ — 도메인 기능 모듈 (세로 슬라이스)

도메인별 기능을 독립된 폴더로 둡니다. 각 feature는 자신의 View 컴포넌트,
feature 전용 store/hook/util을 포함합니다.

## 규칙
- `features/` → `shared/*` import **가능**
- `shared/` → `features/` import **금지** (단방향 의존, ESLint로 강제)
- `features/A` → `features/B` 직접 참조 **금지** (필요 시 shared로 승격하거나 DI)

## 예시 구조
```
features/
└── exam/
    ├── ExamView.tsx
    ├── examStore.ts
    ├── useExamTimer.ts
    └── components/
```

이 평가 시스템의 예상 feature: `exam`(시험), `problem`(문제 출제), `editor`(코드 에디터),
`agent`(제한된 AI 대화), `grading`(채점 결과) 등.
