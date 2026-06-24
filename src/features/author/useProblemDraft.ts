/**
 * useProblemDraft.ts — 문제 출제 폼의 드래프트 상태 훅
 *
 * 편집 대상 문제(source)를 받아 로컬 편집용 드래프트로 복제하고, 필드 단위
 * 갱신 헬퍼를 제공한다. source(선택된 문제)가 바뀌면 드래프트를 재설정한다.
 * source가 null이면 빈 문제(새 출제)로 시작한다.
 *
 * 사용처: features/author/components/ProblemForm
 */
import { useCallback, useState } from 'react';
import type { Problem } from '@/shared/core/types';
import { SUPPORTED_LANGUAGES } from '@/shared/core/constants/languages';
import { DEFAULT_AI_POLICY } from '@/shared/core/constants/aiPolicy';

// ── Types ─────────────────────────────────────────────────────────────────

interface UseProblemDraftResult {
  draft: Problem;
  /** 단일 필드 갱신 */
  updateField: <K extends keyof Problem>(key: K, value: Problem[K]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** 새 출제용 빈 문제를 만든다. */
export function createEmptyProblem(): Problem {
  return {
    id: crypto.randomUUID(),
    title: '',
    statement: '',
    inputFormat: '',
    outputFormat: '',
    timeLimitSec: 2,
    memoryLimitMb: 256,
    allowedLanguageIds: SUPPORTED_LANGUAGES.map((lang) => lang.id),
    testCases: [],
    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useProblemDraft(source: Problem | null): UseProblemDraftResult {
  // 편집 대상(선택)이 바뀌면 부모(AuthorView)가 ProblemForm을 key로 리마운트하므로
  // 별도 동기화 effect 없이 useState 초기화만으로 드래프트가 재설정된다.
  const [draft, setDraft] = useState<Problem>(() => source ?? createEmptyProblem());

  const updateField = useCallback(
    <K extends keyof Problem>(key: K, value: Problem[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { draft, updateField };
}
