/**
 * Modal.tsx — 화면 중앙 오버레이 모달 UI 컴포넌트
 *
 * 배경을 어둡게 덮고 중앙에 콘텐츠 카드를 띄우는 재사용 모달. 헤더(제목 + 닫기
 * 버튼)와 스크롤 가능한 본문을 제공하며, ESC 키·배경 클릭으로 닫고 열려 있는
 * 동안 body 스크롤을 잠근다. 크기(size)로 카드의 최대 너비/높이를 고른다.
 * feature를 import하지 않는 순수 UI — 닫기 동작은 onClose로 주입받는다(DI).
 *
 * 사용처: features/author GradingDashboardView (채점 기준·제출 상세 모달)
 */
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

// ── Types ─────────────────────────────────────────────────────────────────

/** 모달 카드 크기 — md(기준), lg(상세), full(거의 전체). */
type ModalSize = 'md' | 'lg' | 'full';

interface ModalProps {
  /** 모달 표시 여부. false면 아무것도 렌더하지 않는다. */
  isOpen: boolean;
  /** 닫기 요청(ESC·배경 클릭·닫기 버튼). */
  onClose: () => void;
  /** 헤더 좌측 제목. 생략 시 헤더에 닫기 버튼만 표시. */
  title?: React.ReactNode;
  /** 헤더 제목 우측 보조 영역(점수 배지·메타 등). */
  headerExtra?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  /** 본문 패딩 제거(탭 컨테이너처럼 가장자리까지 채우는 경우). */
  isBodyFlush?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  title,
  headerExtra,
  size = 'md',
  children,
  isBodyFlush = false,
}: ModalProps) {
  // ESC로 닫기 + 열린 동안 배경 스크롤 잠금.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <Backdrop onClick={onClose} role="presentation">
      <Card
        $size={size}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <Header>
          <HeaderMain>
            {title !== undefined && <Title>{title}</Title>}
            {headerExtra}
          </HeaderMain>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            ✕
          </CloseButton>
        </Header>
        <Body $flush={isBodyFlush}>{children}</Body>
      </Card>
    </Backdrop>,
    document.body,
  );
}

// ── Styled Components ──────────────────────────────────────────────────────

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: rgba(8, 10, 16, 0.66);
  backdrop-filter: blur(2px);
`;

const SIZE_MAP: Record<ModalSize, { width: string; height: string }> = {
  md: { width: '560px', height: 'auto' },
  lg: { width: '960px', height: '85vh' },
  full: { width: '1200px', height: '90vh' },
};

const Card = styled.div<{ $size: ModalSize }>`
  display: flex;
  flex-direction: column;
  width: ${({ $size }) => SIZE_MAP[$size].width};
  max-width: 100%;
  height: ${({ $size }) => SIZE_MAP[$size].height};
  max-height: 100%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceAlt};
`;

const HeaderMain = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CloseButton = styled.button`
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.font.sizeMd};
  color: ${({ theme }) => theme.colors.textMuted};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Body = styled.div<{ $flush: boolean }>`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme, $flush }) => ($flush ? '0' : theme.spacing.lg)};
`;
