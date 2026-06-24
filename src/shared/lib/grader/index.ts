/**
 * index.ts — 채점기 배럴 & 교체점 (single source of grader)
 *
 * 앱 전체가 쓰는 채점기 인스턴스를 한 곳에서 고정한다. 채점 LLM을 Gemini에서
 * Claude 등으로 바꾸려면 구현 파일을 추가하고 **아래 한 줄만** 교체하면 된다
 * (docs/spec-webcontainer.md §13 결정3 — "채점기 추상화로 1파일 교체").
 *
 * 사용처: app/api/grade/route.ts
 */
import { geminiGrader } from './geminiGrader';
import type { Grader } from './grader';

// 채점기 교체 지점 — 다른 provider로 바꾸려면 이 줄만 교체한다.
export const grader: Grader = geminiGrader;

export type { Grader, RubricGradeInput } from './grader';
