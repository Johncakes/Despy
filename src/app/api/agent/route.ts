/**
 * route.ts (/api/agent) — AI 에이전트 프록시 (Gemini)
 *
 * despy의 유일한 백엔드 책임: (1) Gemini API 키를 서버에 숨기고, (2) 교수가
 * 설정한 시스템 프롬프트를 주입하며, (3) 고정 모델·출력 토큰 한도를 적용해
 * 응답을 스트리밍한다. 응답 종료 시 토큰 사용량을 messageMetadata로 내려보내
 * 클라이언트가 남은 토큰을 계산하게 한다.
 *
 * ⚠️ 질문 횟수/누적 토큰 한도의 최종 강제는 클라이언트(solveSessionStore)에서
 *    이뤄진다(무서버세션 MVP 한계). 이 라우트는 출력 토큰 상한만 강제한다.
 *
 * 사용처: features/solve의 AI 채팅 패널(useChat transport)
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { requireUser, authErrorToResponse } from '@/shared/lib/auth/session';
import type { AgentUsageMetadata } from '@/shared/core/types';

export const runtime = 'nodejs';

// ── Types ─────────────────────────────────────────────────────────────────

interface AgentRequestBody {
  messages: UIMessage[];
  /** 교수가 설정한 가드레일 시스템 프롬프트 */
  systemPrompt?: string;
  /** 고정 Gemini 모델 id */
  model?: string;
  /** 응답 1턴의 출력 토큰 상한 */
  maxOutputTokens?: number;
  /**
   * 학생 화면에서 '직접 편집(자동 반영)'이 켜져 있는지. 켜져 있으면 코드 답변이
   * 에디터에 그대로 반영되므로, AI가 파일 전체를 다시 쓰지 말고 "바뀐 부분만"
   * SEARCH/REPLACE 형식으로 내도록 출력 계약을 시스템에 덧붙인다(반영 안정성·토큰 절약).
   */
  autoApplyEdits?: boolean;
}

const FALLBACK_MODEL = 'gemini-2.5-flash';

/**
 * 자동 반영 모드에서 AI 코드 출력 형식을 고정하는 계약(앱 제어 — 학생 입력 아님).
 * 파일 전체 재출력 대신 "찾을 코드 → 바꿀 코드"만 받아 정확히 일치하는 곳만 교체한다.
 * 클라이언트(markdownCode.parseSearchReplaceEdits)가 이 형식만 파싱·적용하며, SEARCH가
 * 유일하게 일치할 때만 반영하므로 부분 조각이 파일을 훼손하지 않는다.
 */
const EDIT_OUTPUT_CONTRACT = [
  '코드 수정 규칙(매우 중요 — 반드시 지켜라):',
  '- 파일 전체를 다시 쓰지 말고, **바뀌는 부분만** 아래 SEARCH/REPLACE 형식으로 제시하라.',
  '- 변경 1건당 코드블록 하나로, 첫 줄(info)에 대상 파일 경로를 적는다:',
  '  ```edit src/App.jsx',
  '  <<<<<<< SEARCH',
  '  (파일에 실제로 있는 원본 코드를 공백·들여쓰기까지 그대로)',
  '  =======',
  '  (바꿀 새 코드)',
  '  >>>>>>> REPLACE',
  '  ```',
  '- SEARCH에는 파일에서 **한 군데에서만** 일치하도록 충분한 앞뒤 맥락을 포함하라.',
  '  (너무 짧으면 여러 곳에 걸려 반영이 거부된다.)',
  '- 여러 곳을 고치려면 SEARCH/REPLACE 블록을 여러 개 만들어라.',
  '- 코드를 새로 추가할 때는 근처의 기존 코드를 SEARCH로 잡아 그 안에 포함시켜 REPLACE에서 확장하라.',
  '- 이 형식을 벗어난 부분 스니펫은 에디터에 반영되지 않는다.',
].join('\n');

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // 인증 가드 — 로그인한 사용자만 AI 프록시를 사용할 수 있다.
  try {
    await requireUser();
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return new Response(
      'AI API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가하세요.',
      { status: 500 },
    );
  }

  const { messages, systemPrompt, model, maxOutputTokens, autoApplyEdits } =
    (await req.json()) as AgentRequestBody;

  // 교수 가드레일 시스템 프롬프트에 자동 반영 출력 계약(앱 제어)을 덧붙인다.
  // 계약은 학생 입력이 아니라 앱이 정한 형식 지시라 시스템에 두어도 안전하다.
  const system =
    [systemPrompt, autoApplyEdits ? EDIT_OUTPUT_CONTRACT : undefined]
      .filter(Boolean)
      .join('\n\n') || undefined;

  const provider = createGoogleGenerativeAI({ apiKey });

  const result = streamText({
    model: provider(model ?? FALLBACK_MODEL),
    system,
    messages: await convertToModelMessages(messages),
    maxOutputTokens,
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        const usage = part.totalUsage;
        const metadata: AgentUsageMetadata = {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
        };
        return metadata;
      }
      return undefined;
    },
  });
}
