/**
 * ProctoringControls.tsx — 시험 감독 UI(전체화면 권장 배너 + 행동 기록 고지 + 이상행위 배지)
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

interface ProctoringNoticeProps {
  /** true면 기록이 제출 시 교수에게 제공됨을 고지(과제), false면 기록만 고지(알고리즘). */
  reportedToInstructor: boolean;
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

/**
 * 경고 배지 — 탭이탈+붙여넣기 합계가 1 이상일 때만 노출.
 * 전체화면 이탈은 정상 Esc·F11로도 발생(오탐 다수)하므로 경고 합계에서 제외하고
 * 툴팁에 '참고'로만 표시한다. 붙여넣기는 내부 자기복사와 구분되지 않는 약신호다.
 */
export function AnomalyBadge({ log }: AnomalyBadgeProps) {
  const flagged = log.tabSwitchCount + log.externalPasteCount;
  if (flagged === 0) return null;
  return (
    <Badge
      title={`탭 이탈 ${log.tabSwitchCount}회 · 붙여넣기 ${log.externalPasteCount}회 · 전체화면 이탈 ${log.fullscreenExitCount}회(참고)`}
    >
      ⚠ {flagged}
    </Badge>
  );
}

/**
 * 행동 기록 고지 — 풀이 화면에 상시 노출한다.
 * 고지는 (1) PIPA 등 개인정보 수집 고지 의무 정합, (2) deterrence(억제는 학생이
 * 추적 사실을 알아야 효과)의 두 목적을 동시에 만족한다.
 */
export function ProctoringNotice({ reportedToInstructor }: ProctoringNoticeProps) {
  return (
    <Notice>
      ⓘ 이 풀이 화면은 탭 이탈·30자 초과 붙여넣기·전체화면 이탈을 기록합니다
      {reportedToInstructor ? ' — 기록은 제출 시 교수에게 제공됩니다.' : '.'}
    </Notice>
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

const Notice = styled.p`
  margin: 0;
  padding: ${({ theme }) => `2px ${theme.spacing.md}`};
  text-align: center;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;
