/**
 * ChallengeForm.tsx — 과제(ChallengeProblem) 출제/편집 폼
 *
 * 실무형 웹 과제를 한 폼에서 출제한다: 기본 정보(제목·지문) · 시작 파일트리
 * (template, 프리셋 + 파일 단위 편집/잠금) · 실행 명령(setup/dev/test) ·
 * 채점 테스트 파일(testFiles, 학생 비노출) · 루브릭 · AI 정책. 드래프트 상태는
 * useChallengeDraft가 관리하고, 저장/삭제는 콜백(onSubmit/onDelete)으로 부모
 * (ChallengeAuthorView)에 위임한다(DI). (docs/spec-webcontainer.md §5)
 *
 * 사용처: features/author/ChallengeAuthorView
 */
'use client';

import styled from 'styled-components';
import type { ChallengeProblem } from '@/shared/core/types';
import {
  VITE_REACT_SAMPLE_TEMPLATE,
  VITE_REACT_SAMPLE_LOCKED_PATHS,
} from '@/shared/core/constants/webcontainerTemplates';
import { Button } from '@/shared/components/ui/Button';
import { Field, TextInput, TextArea } from '@/shared/components/ui/Field';
import { useChallengeDraft } from '@/features/author/useChallengeDraft';
import { FileSetEditor } from '@/features/author/components/FileSetEditor';
import { RubricEditor } from '@/features/author/components/RubricEditor';
import { AiPolicyFields } from '@/features/author/components/AiPolicyFields';

// ── Types ─────────────────────────────────────────────────────────────────

interface ChallengeFormProps {
  /** 편집 대상. null이면 새 과제 출제 모드. */
  initialChallenge: ChallengeProblem | null;
  onSubmit: (challenge: ChallengeProblem) => void;
  onDelete?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChallengeForm({
  initialChallenge,
  onSubmit,
  onDelete,
}: ChallengeFormProps) {
  const { draft, updateField } = useChallengeDraft(initialChallenge);

  const isValid = draft.title.trim().length > 0;
  const isTemplateEmpty = Object.keys(draft.template).length === 0;

  const handleLoadPreset = () => {
    updateField('template', { ...VITE_REACT_SAMPLE_TEMPLATE });
    updateField('lockedPaths', [...VITE_REACT_SAMPLE_LOCKED_PATHS]);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    // 저장 시점에 입력값을 정규화한다(공백 명령/제목 트림).
    const cleaned: ChallengeProblem = {
      ...draft,
      title: draft.title.trim(),
      setupCommands: draft.setupCommands
        .map((command) => command.trim())
        .filter(Boolean),
    };
    onSubmit(cleaned);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Section>
        <SectionHeader>
          <SectionTitle>기본 정보</SectionTitle>
        </SectionHeader>
        <Field label="제목">
          <TextInput
            value={draft.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="예) 장바구니 삭제 기능 바이브코딩"
          />
        </Field>
        <Field label="지문 (마크다운)" hint="요구사항·시나리오·계약(테스트가 의존하는 약속)을 적습니다.">
          <TextArea
            value={draft.statement}
            onChange={(event) => updateField('statement', event.target.value)}
            rows={8}
          />
        </Field>
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>시작 프로젝트 파일</SectionTitle>
          <Button type="button" variant="ghost" onClick={handleLoadPreset}>
            프리셋 불러오기 (Vite + React)
          </Button>
        </SectionHeader>
        <SectionHint>
          학생에게 주어지는 시작 파일트리입니다. 잠금(read-only) 토글로 ‘주어진 API·골격’을
          고정하세요. 프리셋을 불러오면 현재 파일트리를 덮어씁니다.
        </SectionHint>
        {isTemplateEmpty && (
          <Warning>
            ⚠️ 시작 파일트리가 비어 있습니다. WebContainer가 부팅하려면 최소 한 개 이상의
            파일이 필요합니다(프리셋을 불러오거나 직접 추가하세요).
          </Warning>
        )}
        <FileSetEditor
          files={draft.template}
          onFilesChange={(next) => updateField('template', next)}
          lockedPaths={draft.lockedPaths}
          onLockedPathsChange={(next) => updateField('lockedPaths', next)}
          emptyHint="시작 파일이 없습니다. 프리셋을 불러오거나 파일을 추가하세요."
        />
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>실행 명령</SectionTitle>
        </SectionHeader>
        <Field label="설치(setup) 명령" hint="한 줄에 하나씩 (예: npm install)">
          <TextArea
            value={draft.setupCommands.join('\n')}
            onChange={(event) =>
              updateField('setupCommands', event.target.value.split('\n'))
            }
            rows={2}
          />
        </Field>
        <Grid>
          <Field label="dev 서버 명령">
            <TextInput
              value={draft.devCommand}
              onChange={(event) => updateField('devCommand', event.target.value)}
              placeholder="npm run dev"
            />
          </Field>
          <Field label="테스트 명령">
            <TextInput
              value={draft.testCommand}
              onChange={(event) => updateField('testCommand', event.target.value)}
              placeholder="npm test"
            />
          </Field>
        </Grid>
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>채점 테스트 파일</SectionTitle>
        </SectionHeader>
        <SectionHint>
          제출 시점에만 FS에 주입되는 자동 채점 테스트입니다(학생 비노출). 내부 구현이 아닌
          사용자에게 보이는 동작을 검증하세요(§3.4 — 행동 기준 테스트).
        </SectionHint>
        <FileSetEditor
          files={draft.testFiles}
          onFilesChange={(next) => updateField('testFiles', next)}
          emptyHint="채점 테스트 파일이 없습니다. (비우면 루브릭 비중 위주로 채점됩니다.)"
        />
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>채점 루브릭</SectionTitle>
        </SectionHeader>
        <RubricEditor
          rubric={draft.rubric}
          onChange={(next) => updateField('rubric', next)}
        />
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>AI 에이전트 정책</SectionTitle>
        </SectionHeader>
        <AiPolicyFields
          policy={draft.aiPolicy}
          onChange={(next) => updateField('aiPolicy', next)}
        />
      </Section>

      <Footer>
        {onDelete && (
          <Button type="button" variant="ghost" onClick={onDelete}>
            삭제
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!isValid}>
          저장
        </Button>
      </Footer>
    </Form>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
  padding-left: ${({ theme }) => theme.spacing.sm};
  line-height: 1.2;
`;

const SectionHint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Warning = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.warning};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;
