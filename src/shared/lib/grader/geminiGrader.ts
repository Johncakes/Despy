/**
 * geminiGrader.ts — Gemini 기반 루브릭 채점기 구현
 *
 * `Grader` 인터페이스를 Gemini(generateObject + 구조화 출력)로 구현한다. 학생 제출물·
 * 루브릭·자동테스트 결과를 채점 프롬프트로 구성하고, JSON 스키마로 항목별 점수와
 * 총평을 강제 출력시킨 뒤 score.ts로 루브릭 범위에 맞게 정규화한다.
 *
 * zod 미도입: ai의 jsonSchema 헬퍼로 구조화 출력을 강제한다(새 의존성 없음).
 * API 키는 서버 전용이라 이 모듈은 서버(라우트)에서만 평가된다.
 *
 * 레이어 규칙: shared/lib은 외부 라이브러리(@ai-sdk/google·ai)와 shared/core만 의존.
 *
 * 사용처: shared/lib/grader/index(교체점), app/api/grade
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, jsonSchema } from 'ai';
import type { RubricGradingResult } from '@/shared/core/types';
import type { Grader, RubricGradeInput } from './grader';
import { normalizeRubricResult, type RawRubricScores } from './score';

// ── Constants ─────────────────────────────────────────────────────────────

const FALLBACK_MODEL = 'gemini-2.5-flash';

/** 시스템 프롬프트 미설정 시 기본 채점 가드레일 */
const DEFAULT_GRADING_SYSTEM = `너는 실무형 웹 개발 과제를 채점하는 엄격하고 공정한 채점관이다.
학생이 AI 도구를 활용해 작성한 코드를 루브릭 기준으로 평가한다.
- 내부 구현 방식이 예시와 달라도, 요구사항을 올바르게 충족하면 점수를 준다(행동 기준 채점).
- 각 항목은 그 항목의 만점(maxScore)을 넘지 않는 정수/실수 점수로 매긴다.
- 각 점수에는 코드 근거를 한국어로 간결히 적는다.`;

// ── 스키마 (zod 대신 JSON 스키마) ──────────────────────────────────────────

const rubricScoresSchema = jsonSchema<RawRubricScores>({
  type: 'object',
  additionalProperties: false,
  required: ['scores', 'feedback'],
  properties: {
    scores: {
      type: 'array',
      description: '루브릭 각 항목에 대한 채점. 항목 id별로 정확히 하나씩.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterionId', 'score', 'reason'],
        properties: {
          criterionId: { type: 'string', description: '루브릭 항목 id' },
          score: { type: 'number', description: '이 항목 점수(0 ~ 항목 만점)' },
          reason: { type: 'string', description: '점수 근거(한국어, 간결)' },
        },
      },
    },
    feedback: {
      type: 'string',
      description: '학생에게 줄 종합 피드백(한국어, 강점·개선점)',
    },
  },
});

// ── 구현 ─────────────────────────────────────────────────────────────────────

function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export const geminiGrader: Grader = {
  providerName: 'gemini',

  isAvailable: () => Boolean(getApiKey()),

  async gradeRubric(input: RubricGradeInput): Promise<RubricGradingResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    const provider = createGoogleGenerativeAI({ apiKey });

    const { object } = await generateObject({
      model: provider(input.model || FALLBACK_MODEL),
      system: input.systemPrompt || DEFAULT_GRADING_SYSTEM,
      schema: rubricScoresSchema,
      prompt: buildGradingPrompt(input),
    });

    return normalizeRubricResult(object, input.rubric);
  },
};

// ── 프롬프트 구성 ──────────────────────────────────────────────────────────

function buildGradingPrompt(input: RubricGradeInput): string {
  const criteriaText = input.rubric.criteria
    .map(
      (criterion) =>
        `- [${criterion.id}] ${criterion.description} (만점 ${criterion.maxScore})`,
    )
    .join('\n');

  const filesText = Object.entries(input.submittedFiles)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  const autoTestText = `통과 ${input.autoTest.passedCount}/${input.autoTest.totalCount}\n${input.autoTest.cases
    .map((c) => `- ${c.passed ? '✅' : '❌'} ${c.name}${c.message ? ` — ${c.message}` : ''}`)
    .join('\n')}`;

  const diffSection = input.diff
    ? `\n## 템플릿 대비 변경 diff\n\`\`\`diff\n${input.diff}\n\`\`\`\n`
    : '';

  return `## 과제 요구사항\n${input.statement}\n
## 채점 루브릭\n${criteriaText}\n
## 자동 테스트 결과(참고)\n${autoTestText}\n${diffSection}
## 제출 코드\n${filesText}\n
위 루브릭의 각 항목(criterionId)에 대해 점수와 근거를 매기고, 종합 피드백을 작성하라.`;
}
