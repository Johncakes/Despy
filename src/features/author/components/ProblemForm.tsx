/**
 * ProblemForm.tsx — 문제 출제/편집 폼
 *
 * 문제 지문·입출력 형식·제한·허용 언어·테스트 케이스·AI 정책을 한 폼에서
 * 편집하고 저장한다. 드래프트 상태는 useProblemDraft가 관리하고, 저장/삭제는
 * 콜백(onSubmit/onDelete)으로 부모(AuthorView)에 위임한다(DI).
 *
 * 사용처: features/author/AuthorView
 */
'use client';

import styled from 'styled-components';
import type { Problem } from '@/shared/core/types';
import { SUPPORTED_LANGUAGES } from '@/shared/core/constants/languages';
import { Button } from '@/shared/components/ui/Button';
import { Field, TextInput, TextArea } from '@/shared/components/ui/Field';
import { useProblemDraft } from '@/features/author/useProblemDraft';
import { TestCaseEditor } from '@/features/author/components/TestCaseEditor';
import { AiPolicyFields } from '@/features/author/components/AiPolicyFields';

// ── Types ─────────────────────────────────────────────────────────────────

interface ProblemFormProps {
  /** 편집 대상. null이면 새 문제 출제 모드. */
  initialProblem: Problem | null;
  onSubmit: (problem: Problem) => void;
  onDelete?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ProblemForm({ initialProblem, onSubmit, onDelete }: ProblemFormProps) {
  const { draft, updateField } = useProblemDraft(initialProblem);
  const isValid = draft.title.trim().length > 0;

  const toggleLanguage = (languageId: string, checked: boolean) => {
    const next = checked
      ? [...draft.allowedLanguageIds, languageId]
      : draft.allowedLanguageIds.filter((id) => id !== languageId);
    updateField('allowedLanguageIds', next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    onSubmit(draft);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Section>
        <SectionTitle>기본 정보</SectionTitle>
        <Field label="제목">
          <TextInput
            value={draft.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="예) 두 수의 합"
          />
        </Field>
        <Field label="지문 (마크다운)">
          <TextArea
            value={draft.statement}
            onChange={(event) => updateField('statement', event.target.value)}
            rows={6}
          />
        </Field>
        <Grid>
          <Field label="입력 형식">
            <TextArea
              value={draft.inputFormat}
              onChange={(event) => updateField('inputFormat', event.target.value)}
              rows={3}
            />
          </Field>
          <Field label="출력 형식">
            <TextArea
              value={draft.outputFormat}
              onChange={(event) => updateField('outputFormat', event.target.value)}
              rows={3}
            />
          </Field>
        </Grid>
        <Grid>
          <Field label="시간 제한 (초)">
            <TextInput
              type="number"
              min={1}
              value={draft.timeLimitSec}
              onChange={(event) =>
                updateField('timeLimitSec', toPositiveNumber(event.target.value, 1))
              }
            />
          </Field>
          <Field label="메모리 제한 (MB)">
            <TextInput
              type="number"
              min={16}
              value={draft.memoryLimitMb}
              onChange={(event) =>
                updateField('memoryLimitMb', toPositiveNumber(event.target.value, 16))
              }
            />
          </Field>
        </Grid>
        <Field label="허용 언어">
          <LanguageList>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <LanguageCheck key={lang.id}>
                <input
                  type="checkbox"
                  checked={draft.allowedLanguageIds.includes(lang.id)}
                  onChange={(event) => toggleLanguage(lang.id, event.target.checked)}
                />
                {lang.label}
              </LanguageCheck>
            ))}
          </LanguageList>
        </Field>
      </Section>

      <Section>
        <SectionTitle>테스트 케이스</SectionTitle>
        <TestCaseEditor
          testCases={draft.testCases}
          onChange={(next) => updateField('testCases', next)}
        />
      </Section>

      <Section>
        <SectionTitle>AI 에이전트 정책</SectionTitle>
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

// ── Helpers ───────────────────────────────────────────────────────────────

function toPositiveNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ── Styled Components ─────────────────────────────────────────────────────

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;

const LanguageList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`;

const LanguageCheck = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  cursor: pointer;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;
