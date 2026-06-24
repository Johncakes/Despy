/**
 * aiPolicy.ts — AI 정책 기본값 및 선택 가능한 모델 목록
 *
 * 교수 출제 폼의 기본값과, 모델 고정 드롭다운에 노출할 Gemini Flash 계열
 * 모델 목록을 정의한다. 실제 사용 가능한 모델은 API 키 권한에 따라 다르므로
 * 목록은 가이드이며 임의 문자열도 허용된다(폼에서 직접 입력 가능).
 *
 * 사용처: features/author(정책 폼 기본값), 풀이/채팅 한도 표시
 */
import type { AiPolicy } from '@/shared/core/types';

/** 정책 드롭다운에 노출할 Gemini Flash 계열 모델 (가이드 목록) */
export const GEMINI_FLASH_MODELS: readonly string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-flash-latest',
] as const;

/** AI 정책 기본값 — 새 문제 출제 시 폼 초기값으로 사용 */
export const DEFAULT_AI_POLICY: AiPolicy = {
  model: 'gemini-2.5-flash',
  maxQuestions: 5,
  maxTokens: 20_000,
  systemPrompt: '너는 코딩을 돕는 AI 어시스턴트다. 질문에 성실하고 구체적으로 답하라.',
};
