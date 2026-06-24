/**
 * RubricEditor.tsx — 채점 루브릭 편집기
 *
 * AI 정성 채점 기준(GradingRubric)을 편집한다: 항목(설명·만점) 추가/삭제와,
 * 최종 점수 가중치(자동 테스트 통과율 vs AI 루브릭, 합 1.0)를 입력한다.
 * 가중치 합이 1.0이 아니면 경고 힌트를 표시한다(저장은 막지 않음 — 출제 WIP 허용).
 * 상태를 직접 갖지 않고 rubric/onChange로 부모와 통신한다(제어 컴포넌트).
 *
 * 사용처: features/author/components/ChallengeForm
 */
'use client';

import styled from 'styled-components';
import type { GradingRubric, RubricCriterion } from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';
import { Field, TextInput, TextArea } from '@/shared/components/ui/Field';

// ── Types ─────────────────────────────────────────────────────────────────

interface RubricEditorProps {
  rubric: GradingRubric;
  onChange: (next: GradingRubric) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function RubricEditor({ rubric, onChange }: RubricEditorProps) {
  const patchWeights = (partial: Partial<GradingRubric['weights']>) =>
    onChange({ ...rubric, weights: { ...rubric.weights, ...partial } });

  const handleAddCriterion = () => {
    onChange({
      ...rubric,
      criteria: [
        ...rubric.criteria,
        { id: crypto.randomUUID(), description: '', maxScore: 10 },
      ],
    });
  };

  const handleRemoveCriterion = (id: string) => {
    onChange({
      ...rubric,
      criteria: rubric.criteria.filter((criterion) => criterion.id !== id),
    });
  };

  const handlePatchCriterion = (id: string, patch: Partial<RubricCriterion>) => {
    onChange({
      ...rubric,
      criteria: rubric.criteria.map((criterion) =>
        criterion.id === id ? { ...criterion, ...patch } : criterion,
      ),
    });
  };

  const weightSum = rubric.weights.tests + rubric.weights.rubric;
  const isWeightValid = Math.abs(weightSum - 1) < 1e-6;

  return (
    <Wrapper>
      {rubric.criteria.map((criterion, index) => (
        <Row key={criterion.id}>
          <RowHeader>
            <RowTitle>항목 #{index + 1}</RowTitle>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleRemoveCriterion(criterion.id)}
            >
              삭제
            </Button>
          </RowHeader>
          <Field label="설명">
            <TextArea
              value={criterion.description}
              onChange={(event) =>
                handlePatchCriterion(criterion.id, { description: event.target.value })
              }
              rows={2}
              placeholder="예) 장바구니가 비었을 때 예외 처리"
            />
          </Field>
          <Field label="만점">
            <TextInput
              type="number"
              min={0}
              value={criterion.maxScore}
              onChange={(event) =>
                handlePatchCriterion(criterion.id, {
                  maxScore: toNonNegativeInt(event.target.value),
                })
              }
            />
          </Field>
        </Row>
      ))}

      {rubric.criteria.length === 0 && (
        <Empty>채점 항목이 없습니다. 아래 버튼으로 추가하세요.</Empty>
      )}

      <Button type="button" variant="ghost" onClick={handleAddCriterion}>
        + 루브릭 항목 추가
      </Button>

      <WeightsBox>
        <Grid>
          <Field label="자동 테스트 비중" hint="0~1 (테스트 통과율 가중치)">
            <TextInput
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={rubric.weights.tests}
              onChange={(event) =>
                patchWeights({ tests: toUnitFloat(event.target.value) })
              }
            />
          </Field>
          <Field label="AI 루브릭 비중" hint="0~1 (루브릭 점수 가중치)">
            <TextInput
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={rubric.weights.rubric}
              onChange={(event) =>
                patchWeights({ rubric: toUnitFloat(event.target.value) })
              }
            />
          </Field>
        </Grid>
        <WeightHint $valid={isWeightValid}>
          {isWeightValid
            ? `가중치 합: ${weightSum.toFixed(2)} ✓`
            : `가중치 합: ${weightSum.toFixed(2)} — 합이 1.0이어야 합니다.`}
        </WeightHint>
      </WeightsBox>
    </Wrapper>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toNonNegativeInt(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toUnitFloat(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, parsed));
}

// ── Styled Components ─────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const RowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RowTitle = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
`;

const WeightsBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;

const WeightHint = styled.span<{ $valid: boolean }>`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme, $valid }) =>
    $valid ? theme.colors.success : theme.colors.warning};
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
