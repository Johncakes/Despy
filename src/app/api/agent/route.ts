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
  /**
   * 학생 화면에서 '직접 편집(자동 반영)'이 켜져 있는지. 켜져 있으면 코드 답변이
   * 에디터에 그대로 반영되므로, AI가 부분 조각이 아니라 "파일 전체"를 한 블록으로
   * 내도록 출력 계약을 시스템에 덧붙인다(반영 안정성).
   */
  applyFullFile?: boolean;
}

const FALLBACK_MODEL = 'gemini-2.5-flash';

/**
 * 자동 반영 모드에서 AI 코드 출력 형식을 고정하는 계약(앱 제어 — 학생 입력 아님).
 * 부분 스니펫이 파일을 조각으로 덮어쓰는 사고를 막기 위해, 수정 결과를 항상 전체
 * 파일 하나로 내고 첫 줄에 경로를 적게 한다. 클라이언트(markdownCode)는 이 형식의
 * 완성된 블록만 에디터에 반영한다.
 */
const FULL_FILE_OUTPUT_CONTRACT = [
  '코드 출력 규칙(중요):',
  '- 파일을 수정·작성할 때는 설명용 부분 조각을 여러 개로 쪼개지 말고,',
  '  변경된 **파일의 전체 최종 내용**을 하나의 코드블록으로 제시하라.',
  '- 코드블록 첫 줄(info)에 대상 파일 경로를 함께 적어라. 예: ```jsx src/App.jsx',
  '- 한 번에 한 파일만 전체로 제시하라(여러 파일을 바꿔야 하면 가장 핵심 파일 위주로).',
  '- 부분 스니펫만 제시하면 에디터에 자동 반영되지 않으니, 반드시 전체 파일을 내라.',
].join('\n');

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

  const { messages, systemPrompt, model, maxOutputTokens, applyFullFile } =
    (await req.json()) as AgentRequestBody;

  // 교수 가드레일 시스템 프롬프트에 자동 반영 출력 계약(앱 제어)을 덧붙인다.
  // 계약은 학생 입력이 아니라 앱이 정한 형식 지시라 시스템에 두어도 안전하다.
  const system =
    [systemPrompt, applyFullFile ? FULL_FILE_OUTPUT_CONTRACT : undefined]
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
