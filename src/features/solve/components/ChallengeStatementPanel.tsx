/**
 * ChallengeStatementPanel.tsx — 과제 지문 패널 (WebContainer 피벗)
 *
 * 실무형 웹 과제(ChallengeProblem)의 제목·마크다운 지문(요구사항·계약)을 보여준다.
 * 알고리즘 문제의 입출력 형식·예제(구 ProblemPanel)와 달리, 과제는 마크다운 지문이
 * 단일 출처라 그대로 렌더한다. 표시 전용으로 title·statement만 받는다(제어 컴포넌트).
 *
 * 사용처: features/solve/ChallengeSolveView
 */
'use client';

import { Panel } from '@/shared/components/ui/Panel';
import { Markdown } from '@/shared/components/ui/Markdown';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChallengeStatementPanelProps {
  title: string;
  /** 마크다운 지문 (요구사항·계약) */
  statement: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeStatementPanel({
  title,
  statement,
}: ChallengeStatementPanelProps) {
  return (
    <Panel title={title}>
      <Markdown>{statement}</Markdown>
    </Panel>
  );
}
