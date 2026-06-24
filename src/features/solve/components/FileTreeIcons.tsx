/**
 * FileTreeIcons.tsx — 파일 트리용 인라인 SVG 아이콘 (VSC 탐색기 스타일)
 *
 * 이모지 대신 stroke 기반 단색 아이콘으로 트리/툴바/행 액션을 그린다. 모두 24×24
 * viewBox에 `stroke="currentColor"`라 부모 색(theme)과 hover 색을 그대로 따른다.
 * 새 의존성 없이(Feather 계열 path를 직접 사용) 가볍게 유지한다.
 *
 * 사용처: features/solve/components/FileTree
 */
'use client';

// ── Types ─────────────────────────────────────────────────────────────────

interface IconProps {
  /** 한 변 크기(px). 기본 16. */
  size?: number;
}

// ── 공통 래퍼 ─────────────────────────────────────────────────────────────

function Svg({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

// ── 아이콘 ─────────────────────────────────────────────────────────────────

export function ChevronRightIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

export function FolderIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function FileIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </Svg>
  );
}

export function NewFileIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </Svg>
  );
}

export function NewFolderIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </Svg>
  );
}

export function RenameIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Svg>
  );
}

export function TrashIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </Svg>
  );
}

export function LockIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}
