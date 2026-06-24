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
}

const FALLBACK_MODEL = 'gemini-2.5-flash';

// ── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return new Response(
      'AI API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가하세요.',
      { status: 500 },
    );
  }

  const { messages, systemPrompt, model, maxOutputTokens } =
    (await req.json()) as AgentRequestBody;

  const provider = createGoogleGenerativeAI({ apiKey });

  const result = streamText({
    model: provider(model ?? FALLBACK_MODEL),
    system: systemPrompt,
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
