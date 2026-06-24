/**
 * ProctoringControls.tsx — 시험 감독 UI(전체화면 권장 배너 + 이상행위 배지)
 *
 * useProctoringMonitor가 측정한 상태를 props로 받아 표시만 하는 표현 전용 컴포넌트.
 * 측정·집계는 훅이 담당하고, 이 컴포넌트는 화면 표시만 담당한다(DI — 상태는 props 주입).
 * SolveView·ChallengeSolveView 두 풀이 화면이 동일 UI를 재사용한다(중복 제거).
 *
 * 사용처: features/solve/SolveView, features/solve/ChallengeSolveView
 */
import styled from 'styled-components';
import type { IntegrityLog } from '@/shared/core/types';

// ── Types ─────────────────────────────────────────────────────────────────

interface FullscreenPromptProps {
  isFullscreen: boolean;
  onRequestFullscreen: () => void;
}

interface AnomalyBadgeProps {
  log: IntegrityLog;
}

// ── Components ──────────────────────────────────────────────────────────────

/** 전체화면이 아닐 때만 노출되는 전체화면 권장 배너. */
export function FullscreenPrompt({ isFullscreen, onRequestFullscreen }: FullscreenPromptProps) {
  if (isFullscreen) return null;
  return (
    <Banner>
      시험 모드를 위해 전체화면을 권장합니다.
      <PromptButton type="button" onClick={onRequestFullscreen}>
        전체화면 시작
      </PromptButton>
    </Banner>
  );
}

/** 이상행위(탭이탈+붙여넣기+전체화면이탈) 합계가 1 이상일 때만 노출되는 경고 배지. */
export function AnomalyBadge({ log }: AnomalyBadgeProps) {
  const total = log.tabSwitchCount + log.externalPasteCount + log.fullscreenExitCount;
  if (total === 0) return null;
  return (
    <Badge
      title={`탭 이탈 ${log.tabSwitchCount}회 · 외부 붙여넣기 ${log.externalPasteCount}회 · 전체화면 이탈 ${log.fullscreenExitCount}회`}
    >
      ⚠ {total}
    </Badge>
  );
}

// ── Styled Components ───────────────────────────────────────────────────────

const Banner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PromptButton = styled.button`
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-family: inherit;
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
`;

const Badge = styled.span`
  padding: ${({ theme }) => `2px ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.warning};
  border: 1px solid ${({ theme }) => theme.colors.warning};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: default;
  white-space: nowrap;
`;
