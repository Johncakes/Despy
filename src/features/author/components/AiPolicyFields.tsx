/**
 * AiPolicyFields.tsx — AI 에이전트 정책 편집 필드
 *
 * 교수가 문제별 AI 통제 정책을 설정한다: 고정 모델, 문제당 질문 횟수/토큰 한도,
 * 그리고 답변 가드레일 시스템 프롬프트. 제어 컴포넌트로 policy/onChange만 받는다.
 *
 * 사용처: features/author/components/ProblemForm
 */
'use client';

import styled from 'styled-components';
import type { AiPolicy } from '@/shared/core/types';
import { GEMINI_FLASH_MODELS } from '@/shared/core/constants/aiPolicy';
import { Field, TextInput, TextArea, Select } from '@/shared/components/ui/Field';

// ── Types ─────────────────────────────────────────────────────────────────

interface AiPolicyFieldsProps {
  policy: AiPolicy;
  onChange: (next: AiPolicy) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function AiPolicyFields({ policy, onChange }: AiPolicyFieldsProps) {
  const patch = (partial: Partial<AiPolicy>) => onChange({ ...policy, ...partial });

  return (
    <Wrapper>
      <Field label="고정 모델" hint="학생은 이 모델만 사용할 수 있습니다.">
        <Select
          value={policy.model}
          onChange={(event) => patch({ model: event.target.value })}
        >
          {GEMINI_FLASH_MODELS.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
          {!GEMINI_FLASH_MODELS.includes(policy.model) && (
            <option value={policy.model}>{policy.model}</option>
          )}
        </Select>
      </Field>

      <Grid>
        <Field label="질문 횟수 한도" hint="문제당 최대 AI 질문 수">
          <TextInput
            type="number"
            min={0}
            value={policy.maxQuestions}
            onChange={(event) =>
              patch({ maxQuestions: toNonNegativeInt(event.target.value) })
            }
          />
        </Field>
        <Field label="토큰 한도" hint="문제당 누적 토큰(입력+출력)">
          <TextInput
            type="number"
            min={0}
            value={policy.maxTokens}
            onChange={(event) =>
              patch({ maxTokens: toNonNegativeInt(event.target.value) })
            }
          />
        </Field>
      </Grid>

      <Field
        label="시스템 프롬프트 (가드레일)"
        hint="AI 답변 정책. 학생에게 노출되지 않도록 의도된 가드레일입니다."
      >
        <TextArea
          value={policy.systemPrompt}
          onChange={(event) => patch({ systemPrompt: event.target.value })}
          rows={5}
        />
      </Field>
    </Wrapper>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toNonNegativeInt(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;
