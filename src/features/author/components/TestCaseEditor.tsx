/**
 * TestCaseEditor.tsx — 테스트 케이스 편집기
 *
 * 문제의 입력/기대출력 쌍을 추가·삭제·수정한다. 케이스별 공개 여부(isPublic)를
 * 토글할 수 있으며, 비공개 케이스는 학생 풀이 화면에서 내용이 가려진다.
 * 상태를 직접 갖지 않고 testCases/onChange로 부모와 통신한다(제어 컴포넌트).
 *
 * 사용처: features/author/components/ProblemForm
 */
'use client';

import styled from 'styled-components';
import type { TestCase } from '@/shared/core/types';
import { Button } from '@/shared/components/ui/Button';
import { TextArea } from '@/shared/components/ui/Field';

// ── Types ─────────────────────────────────────────────────────────────────

interface TestCaseEditorProps {
  testCases: TestCase[];
  onChange: (next: TestCase[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function TestCaseEditor({ testCases, onChange }: TestCaseEditorProps) {
  const handleAdd = () => {
    onChange([
      ...testCases,
      { id: crypto.randomUUID(), input: '', expectedOutput: '', isPublic: true },
    ]);
  };

  const handleRemove = (id: string) => {
    onChange(testCases.filter((testCase) => testCase.id !== id));
  };

  const handlePatch = (id: string, patch: Partial<TestCase>) => {
    onChange(
      testCases.map((testCase) =>
        testCase.id === id ? { ...testCase, ...patch } : testCase,
      ),
    );
  };

  return (
    <Wrapper>
      {testCases.map((testCase, index) => (
        <Row key={testCase.id}>
          <RowHeader>
            <RowTitle>케이스 #{index + 1}</RowTitle>
            <RowActions>
              <PublicToggle>
                <input
                  type="checkbox"
                  checked={testCase.isPublic}
                  onChange={(event) =>
                    handlePatch(testCase.id, { isPublic: event.target.checked })
                  }
                />
                공개
              </PublicToggle>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleRemove(testCase.id)}
              >
                삭제
              </Button>
            </RowActions>
          </RowHeader>
          <Grid>
            <Cell>
              <CellLabel>입력 (stdin)</CellLabel>
              <TextArea
                value={testCase.input}
                onChange={(event) =>
                  handlePatch(testCase.id, { input: event.target.value })
                }
                placeholder={'예) 4\\n2 7 11 15\\n9'}
              />
            </Cell>
            <Cell>
              <CellLabel>기대 출력 (stdout)</CellLabel>
              <TextArea
                value={testCase.expectedOutput}
                onChange={(event) =>
                  handlePatch(testCase.id, { expectedOutput: event.target.value })
                }
                placeholder={'예) 0 1'}
              />
            </Cell>
          </Grid>
        </Row>
      ))}

      {testCases.length === 0 && (
        <Empty>아직 테스트 케이스가 없습니다. 아래 버튼으로 추가하세요.</Empty>
      )}

      <Button type="button" variant="ghost" onClick={handleAdd}>
        + 테스트 케이스 추가
      </Button>
    </Wrapper>
  );
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

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const PublicToggle = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const CellLabel = styled.span`
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
