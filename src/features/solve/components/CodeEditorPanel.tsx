/**
 * CodeEditorPanel.tsx — 코드 에디터 패널 (Monaco)
 *
 * 언어 선택 + Monaco 에디터 + 실행/제출 액션을 묶는다. Monaco는 브라우저 전용
 * 이므로 next/dynamic(ssr:false)으로 클라이언트에서만 로드한다. 상태는 갖지
 * 않고 props/콜백으로만 통신한다(제어 컴포넌트).
 *
 * 사용처: features/solve/SolveView
 */
'use client';

import dynamic from 'next/dynamic';
import styled from 'styled-components';
import type { SupportedLanguage } from '@/shared/core/types';
import { findLanguageById } from '@/shared/core/constants/languages';
import { Panel } from '@/shared/components/ui/Panel';
import { Button } from '@/shared/components/ui/Button';
import { Select } from '@/shared/components/ui/Field';

// Monaco는 window 의존 → 클라이언트에서만 로드
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <EditorLoading>에디터 로딩 중…</EditorLoading>,
});

// ── Types ─────────────────────────────────────────────────────────────────

interface CodeEditorPanelProps {
  allowedLanguages: readonly SupportedLanguage[];
  languageId: string;
  code: string;
  onCodeChange: (code: string) => void;
  onLanguageChange: (languageId: string) => void;
  onRunExamples: () => void;
  onSubmit: () => void;
  isGrading: boolean;
  /** AI가 코드를 작성 중이면 에디터를 읽기 전용으로 잠근다(충돌 방지) */
  isReadOnly?: boolean;
  /** AI가 작성한 코드를 직전 상태로 되돌릴 수 있는지 */
  canUndoAiCode?: boolean;
  onUndoAiCode?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function CodeEditorPanel({
  allowedLanguages,
  languageId,
  code,
  onCodeChange,
  onLanguageChange,
  onRunExamples,
  onSubmit,
  isGrading,
  isReadOnly = false,
  canUndoAiCode = false,
  onUndoAiCode,
}: CodeEditorPanelProps) {
  const monacoLanguage = findLanguageById(languageId)?.monacoLanguage ?? 'plaintext';

  return (
    <Panel
      title={
        <TitleRow>
          <Select
            value={languageId}
            onChange={(event) => onLanguageChange(event.target.value)}
          >
            {allowedLanguages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </Select>
          {isReadOnly && <WritingTag>AI 작성 중…</WritingTag>}
        </TitleRow>
      }
      actions={
        <>
          {canUndoAiCode && onUndoAiCode && (
            <Button variant="ghost" onClick={onUndoAiCode} disabled={isGrading}>
              되돌리기
            </Button>
          )}
          <Button variant="ghost" onClick={onRunExamples} disabled={isGrading}>
            예제 실행
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={isGrading}>
            {isGrading ? '채점 중…' : '제출'}
          </Button>
        </>
      }
      isBodyFlush
    >
      <EditorHost>
        <MonacoEditor
          height="100%"
          theme="vs"
          language={monacoLanguage}
          value={code}
          onChange={(value) => onCodeChange(value ?? '')}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            readOnly: isReadOnly,
          }}
        />
      </EditorHost>
    </Panel>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const WritingTag = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.info};
`;

const EditorHost = styled.div`
  height: 100%;
  min-height: 0;
`;

const EditorLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.sizeSm};
`;
