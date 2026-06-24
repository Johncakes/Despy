/**
 * useChallengeDraft.ts — 과제(ChallengeProblem) 출제 폼의 드래프트 상태 훅
 *
 * 편집 대상 과제(source)를 받아 로컬 편집용 드래프트로 복제하고, 필드 단위
 * 갱신 헬퍼를 제공한다. source(선택된 과제)가 바뀌면 부모(ChallengeAuthorView)가
 * ChallengeForm을 key로 리마운트하므로 useState 초기화만으로 드래프트가 재설정된다.
 * source가 null이면 빈 과제(새 출제 — 프리셋 미적재)로 시작한다.
 *
 * (구 알고리즘 출제는 useProblemDraft 사용. 이 훅은 WebContainer 피벗 과제용.)
 *
 * 사용처: features/author/components/ChallengeForm
 */
import { useCallback, useState } from 'react';
import type { ChallengeProblem } from '@/shared/core/types';
import { DEFAULT_AI_POLICY } from '@/shared/core/constants/aiPolicy';

// ── Types ─────────────────────────────────────────────────────────────────

interface UseChallengeDraftResult {
  draft: ChallengeProblem;
  /** 단일 필드 갱신 */
  updateField: <K extends keyof ChallengeProblem>(
    key: K,
    value: ChallengeProblem[K],
  ) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * 새 출제용 빈 과제를 만든다. 시작 파일트리는 비어 있고, 출제자는
 * ChallengeForm의 "프리셋 불러오기"로 부팅 검증된 샘플 트리를 적재할 수 있다.
 */
export function createEmptyChallenge(): ChallengeProblem {
  return {
    id: crypto.randomUUID(),
    kind: 'workspace',
    title: '',
    statement: '',
    template: {},
    lockedPaths: [],
    // 비면 lockedPaths의 보수로 간주된다(타입 주석). 강조 표시 전용이라 폼에서 직접 다루지 않는다.
    editablePaths: [],
    setupCommands: ['npm install'],
    devCommand: 'npm run dev',
    testCommand: 'npm test',
    testFiles: {},
    rubric: {
      criteria: [],
      // testFiles가 비어 있을 수 있으므로 초기엔 루브릭 비중을 높게 둔다.
      weights: { tests: 0.3, rubric: 0.7 },
    },
    aiPolicy: { ...DEFAULT_AI_POLICY },
    createdAt: 0,
    updatedAt: 0,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useChallengeDraft(
  source: ChallengeProblem | null,
): UseChallengeDraftResult {
  const [draft, setDraft] = useState<ChallengeProblem>(
    () => source ?? createEmptyChallenge(),
  );

  const updateField = useCallback(
    <K extends keyof ChallengeProblem>(key: K, value: ChallengeProblem[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { draft, updateField };
}
