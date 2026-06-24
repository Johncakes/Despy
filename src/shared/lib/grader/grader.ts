/**
 * grader.ts — 루브릭 채점기 추상화 (모델 비의존 인터페이스)
 *
 * AI 정성 채점을 수행하는 채점기의 계약을 정의한다. 구현체(Gemini 등)는 이 인터페이스만
 * 만족하면 되고, 라우트(/api/grade)는 구현 세부(provider·prompt·structured output)를 모른 채
 * `Grader`로만 채점한다. 후일 채점 LLM을 Claude 등으로 교체할 때 구현 파일만 추가하고
 * `index.ts`의 한 줄만 바꾸면 되도록 한 분리다(docs/spec-webcontainer.md §13 결정3).
 *
 * 레이어 규칙: shared/lib은 외부 라이브러리와 shared/core(타입)만 의존한다.
 *
 * 사용처: shared/lib/grader/geminiGrader(구현), shared/lib/grader/index(교체점), app/api/grade
 */
import type {
  AutoTestResult,
  GradingResult,
  GradingRubric,
  ProjectFiles,
  RubricGradingResult,
  TestCase,
} from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * 루브릭 채점 입력. 학생 제출물·루브릭·자동테스트 결과와 교수가 설정한
 * 가드레일(모델·시스템 프롬프트)을 모은 모델 비의존 페이로드다.
 */
export interface RubricGradeInput {
  /** 과제 요구사항 마크다운 (채점 맥락) */
  statement: string;
  /** 채점 기준(항목·만점·가중치). 점수 정규화의 단일 출처. */
  rubric: GradingRubric;
  /** 학생이 제출한(변경한) 파일 — 경로→내용 평면 맵 */
  submittedFiles: ProjectFiles;
  /** 선택: 템플릿 대비 변경 diff (제공 시 채점 맥락 보강) */
  diff?: string;
  /** WebContainer 자동 테스트 결과 (채점 참고용 신호) */
  autoTest: AutoTestResult;
  /** 채점에 사용할 모델 id */
  model: string;
  /** 교수가 설정한 채점 가드레일 시스템 프롬프트 (선택) */
  systemPrompt?: string;
}

/**
 * 알고리즘 채점 입력. 지문·언어·테스트케이스(입력/기대출력)와 학생 제출 코드를 모은
 * 모델 비의존 페이로드다. 채점기는 코드를 실행하지 않고 각 케이스의 정답성을 판정한다.
 */
export interface AlgorithmGradeInput {
  /** 문제 식별자 (결과에 그대로 담는다) */
  problemId: string;
  /** 문제 지문 마크다운 (채점 맥락) */
  statement: string;
  /** 작성 언어 표시명 (예: 'Python 3') — 채점 맥락 */
  languageLabel: string;
  /** 작성 언어 id (결과에 그대로 담는다) */
  languageId: string;
  /** 학생 제출 소스 코드 (신뢰 불가 입력) */
  sourceCode: string;
  /** 채점할 테스트케이스(입력/기대출력). 정답성 판정의 단일 출처. */
  testCases: TestCase[];
  /** 채점에 사용할 모델 id */
  model: string;
  /** 교수가 설정한 채점 가드레일 시스템 프롬프트 (선택) */
  systemPrompt?: string;
}

/**
 * 채점기. 구현체는 LLM·프롬프트·구조화 출력을 캡슐화한다. 루브릭 채점은 정규화된
 * `RubricGradingResult`(점수는 만점 범위로 클램프)를, 알고리즘 채점은 케이스별
 * 통과/실패를 판정한 `GradingResult`를 반환한다.
 */
export interface Grader {
  /** 식별용 provider 이름 (로깅·디버깅) */
  readonly providerName: string;
  /** 환경(API 키 등)이 갖춰져 채점 가능한지 — 라우트가 사전 점검에 쓴다 */
  isAvailable(): boolean;
  /** 루브릭 정성 채점 — 구조화 출력으로 RubricGradingResult를 강제한다 */
  gradeRubric(input: RubricGradeInput): Promise<RubricGradingResult>;
  /** 알고리즘 정성 채점 — 테스트케이스 기준으로 케이스별 정답성을 판정한다 */
  gradeAlgorithm(input: AlgorithmGradeInput): Promise<GradingResult>;
}
