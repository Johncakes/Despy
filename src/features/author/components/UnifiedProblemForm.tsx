/**
 * UnifiedProblemForm.tsx — 문제 출제/편집 통합 폼 (웹 및 알고리즘)
 *
 * 문제 제목·지문과 질문 유형(웹 또는 알고리즘)을 설정하고, 유형 선택 시
 * 관련 상세 필드(프로젝트 파일, 실행 명령, 루브릭, 언어 제한, 테스트 케이스 등)를
 * 동적으로 로드한다. 유형이 지정되지 않은 경우, 상세 옵션을 채우기 전에 유형을
 * 선택해야 한다는 가이드 배너를 제공한다.
 *
 * 사용처: features/author/CombinedAuthorView
 */
'use client';

import { useState } from 'react';
import styled from 'styled-components';
import type { ChallengeProblem, Problem } from '@/shared/core/types';
import { SUPPORTED_LANGUAGES } from '@/shared/core/constants/languages';
import {
  VITE_REACT_SAMPLE_TEMPLATE,
  VITE_REACT_SAMPLE_LOCKED_PATHS,
} from '@/shared/core/constants/webcontainerTemplates';
import { Button } from '@/shared/components/ui/Button';
import { Field, TextInput, TextArea, Select } from '@/shared/components/ui/Field';
import { useChallengeDraft } from '@/features/author/useChallengeDraft';
import { useProblemDraft } from '@/features/author/useProblemDraft';
import { FileSetEditor } from '@/features/author/components/FileSetEditor';
import { RubricEditor } from '@/features/author/components/RubricEditor';
import { TestCaseEditor } from '@/features/author/components/TestCaseEditor';
import { AiPolicyFields } from '@/features/author/components/AiPolicyFields';

interface UnifiedProblemFormProps {
  /** 편집 대상의 유형. 새 문제 출제 시 null */
  initialType: 'web' | 'algo' | null;
  /** 편집 대상 문제 데이터. 새 문제 출제 시 null */
  initialProblem: ChallengeProblem | Problem | null;
  onSubmit: (type: 'web' | 'algo', problem: ChallengeProblem | Problem) => void;
  onDelete?: () => void;
  /** 저장(서버 생성/수정) 진행 중 여부. 버튼 비활성·라벨에 반영한다. */
  isSaving?: boolean;
}

export function UnifiedProblemForm({
  initialType,
  initialProblem,
  onSubmit,
  onDelete,
  isSaving = false,
}: UnifiedProblemFormProps) {
  const [type, setType] = useState<'web' | 'algo' | ''>(initialType ?? '');

  // 두 유형의 초안 상태를 모두 선언하되, 편집 대상에 따라 초기값을 주입한다.
  const webDraft = useChallengeDraft(
    initialType === 'web' ? (initialProblem as ChallengeProblem) : null
  );
  const algoDraft = useProblemDraft(
    initialType === 'algo' ? (initialProblem as Problem) : null
  );

  const isEditing = initialType !== null;
  const isWeb = type === 'web';
  const isAlgo = type === 'algo';

  // 현재 활성 상태인 드래프트 참조
  const activeTitle = isWeb ? webDraft.draft.title : isAlgo ? algoDraft.draft.title : '';
  const activeStatement = isWeb ? webDraft.draft.statement : isAlgo ? algoDraft.draft.statement : '';

  const isValid = activeTitle.trim().length > 0;

  // 제목 및 지문 공통 동기화
  const handleTitleChange = (val: string) => {
    if (isWeb) webDraft.updateField('title', val);
    if (isAlgo) algoDraft.updateField('title', val);
  };

  const handleStatementChange = (val: string) => {
    if (isWeb) webDraft.updateField('statement', val);
    if (isAlgo) algoDraft.updateField('statement', val);
  };

  // 웹(Web Challenge) 관련 헬퍼
  const isTemplateEmpty = Object.keys(webDraft.draft.template).length === 0;
  const handleLoadPreset = () => {
    webDraft.updateField('template', { ...VITE_REACT_SAMPLE_TEMPLATE });
    webDraft.updateField('lockedPaths', [...VITE_REACT_SAMPLE_LOCKED_PATHS]);
  };

  // 알고리즘 관련 헬퍼
  const toggleLanguage = (languageId: string, checked: boolean) => {
    const next = checked
      ? [...algoDraft.draft.allowedLanguageIds, languageId]
      : algoDraft.draft.allowedLanguageIds.filter((id) => id !== languageId);
    algoDraft.updateField('allowedLanguageIds', next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;

    if (isWeb) {
      const cleaned: ChallengeProblem = {
        ...webDraft.draft,
        title: webDraft.draft.title.trim(),
        setupCommands: webDraft.draft.setupCommands
          .map((cmd) => cmd.trim())
          .filter(Boolean),
      };
      onSubmit('web', cleaned);
    } else if (isAlgo) {
      onSubmit('algo', algoDraft.draft);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Section>
        <SectionHeader>
          <SectionTitle>기본 정보</SectionTitle>
        </SectionHeader>

        <Field label="문제 유형" hint={isEditing ? '이미 등록된 문제의 유형은 변경할 수 없습니다.' : undefined}>
          <Select
            value={type}
            disabled={isEditing}
            onChange={(event) => setType(event.target.value as 'web' | 'algo' | '')}
          >
            <option value="">-- 유형을 선택하세요 --</option>
            <option value="web">실무형 웹 문제 (Web)</option>
            <option value="algo">알고리즘 문제 (Algorithm)</option>
          </Select>
        </Field>

        {type !== '' && (
          <>
            <Field label="제목">
              <TextInput
                value={activeTitle}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder={isWeb ? '예) 장바구니 삭제 기능 구현하기' : '예) 두 수의 합'}
              />
            </Field>
            <Field label="지문 (마크다운)" hint={isWeb ? '요구사항·시나리오·계약(테스트가 의존하는 약속)을 적습니다.' : undefined}>
              <TextArea
                value={activeStatement}
                onChange={(event) => handleStatementChange(event.target.value)}
                rows={6}
              />
            </Field>
          </>
        )}
      </Section>

      {/* 유형 미선택 시 나타나는 안내 배너 */}
      {type === '' && (
        <IndicatorCard>
          <IndicatorIcon>💡</IndicatorIcon>
          <IndicatorContent>
            <IndicatorTitle>상세 옵션 활성화 안내</IndicatorTitle>
            <IndicatorDesc>
              위에서 <strong>문제 유형(웹 또는 알고리즘)</strong>을 선택하시면, 시작 파일 트리, 테스트 케이스, AI 에이전트 정책 등 문제 출제를 완료하기 위한 상세 설정 필드가 여기에 활성화됩니다.
            </IndicatorDesc>
          </IndicatorContent>
        </IndicatorCard>
      )}

      {/* 웹 문제 상세 설정 */}
      {isWeb && (
        <>
          <Section>
            <SectionHeader>
              <SectionTitle>시작 프로젝트 파일</SectionTitle>
              <Button type="button" variant="ghost" onClick={handleLoadPreset}>
                프리셋 불러오기 (Vite + React)
              </Button>
            </SectionHeader>
            <SectionHint>
              학생에게 주어지는 시작 파일트리입니다. 잠금(read-only) 토글로 골격 코드를 고정하세요. 프리셋을 불러오면 현재 파일트리를 덮어씁니다.
            </SectionHint>
            {isTemplateEmpty && (
              <Warning>
                ⚠️ 시작 파일트리가 비어 있습니다. WebContainer가 동작하려면 최소 한 개 이상의 파일이 필요합니다. 프리셋을 적재하거나 파일을 직접 추가하세요.
              </Warning>
            )}
            <FileSetEditor
              files={webDraft.draft.template}
              onFilesChange={(next) => webDraft.updateField('template', next)}
              lockedPaths={webDraft.draft.lockedPaths}
              onLockedPathsChange={(next) => webDraft.updateField('lockedPaths', next)}
              emptyHint="시작 파일이 없습니다. 프리셋을 불러오거나 파일을 추가하세요."
            />
          </Section>

          <Section>
            <SectionHeader>
              <SectionTitle>실행 명령</SectionTitle>
            </SectionHeader>
            <Field label="설치(setup) 명령" hint="한 줄에 하나씩 (예: npm install)">
              <TextArea
                value={webDraft.draft.setupCommands.join('\n')}
                onChange={(event) =>
                  webDraft.updateField('setupCommands', event.target.value.split('\n'))
                }
                rows={2}
              />
            </Field>
            <Grid>
              <Field label="dev 서버 명령">
                <TextInput
                  value={webDraft.draft.devCommand}
                  onChange={(event) => webDraft.updateField('devCommand', event.target.value)}
                  placeholder="npm run dev"
                />
              </Field>
              <Field label="테스트 명령">
                <TextInput
                  value={webDraft.draft.testCommand}
                  onChange={(event) => webDraft.updateField('testCommand', event.target.value)}
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
              제출 시점에 가상 환경에 주입되어 학생 코드를 동작 검증하는 자동 채점 파일입니다(학생 비노출).
            </SectionHint>
            <FileSetEditor
              files={webDraft.draft.testFiles}
              onFilesChange={(next) => webDraft.updateField('testFiles', next)}
              emptyHint="채점 테스트 파일이 없습니다. (비워두면 AI 정성 평가 비중으로 채점됩니다.)"
            />
          </Section>

          <Section>
            <SectionHeader>
              <SectionTitle>채점 루브릭</SectionTitle>
            </SectionHeader>
            <RubricEditor
              rubric={webDraft.draft.rubric}
              onChange={(next) => webDraft.updateField('rubric', next)}
            />
          </Section>

          <Section>
            <SectionHeader>
              <SectionTitle>AI 에이전트 정책</SectionTitle>
            </SectionHeader>
            <AiPolicyFields
              policy={webDraft.draft.aiPolicy}
              onChange={(next) => webDraft.updateField('aiPolicy', next)}
            />
          </Section>
        </>
      )}

      {/* 알고리즘 문제 상세 설정 */}
      {isAlgo && (
        <>
          <Section>
            <SectionHeader>
              <SectionTitle>제한 사항 및 입력 형식</SectionTitle>
            </SectionHeader>
            <Grid>
              <Field label="입력 형식">
                <TextArea
                  value={algoDraft.draft.inputFormat}
                  onChange={(event) => algoDraft.updateField('inputFormat', event.target.value)}
                  rows={3}
                />
              </Field>
              <Field label="출력 형식">
                <TextArea
                  value={algoDraft.draft.outputFormat}
                  onChange={(event) => algoDraft.updateField('outputFormat', event.target.value)}
                  rows={3}
                />
              </Field>
            </Grid>
            <Grid>
              <Field label="시간 제한 (초)">
                <TextInput
                  type="number"
                  min={1}
                  value={algoDraft.draft.timeLimitSec}
                  onChange={(event) =>
                    algoDraft.updateField('timeLimitSec', toPositiveNumber(event.target.value, 1))
                  }
                />
              </Field>
              <Field label="메모리 제한 (MB)">
                <TextInput
                  type="number"
                  min={16}
                  value={algoDraft.draft.memoryLimitMb}
                  onChange={(event) =>
                    algoDraft.updateField('memoryLimitMb', toPositiveNumber(event.target.value, 16))
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
                      checked={algoDraft.draft.allowedLanguageIds.includes(lang.id)}
                      onChange={(event) => toggleLanguage(lang.id, event.target.checked)}
                    />
                    {lang.label}
                  </LanguageCheck>
                ))}
              </LanguageList>
            </Field>
          </Section>

          <Section>
            <SectionHeader>
              <SectionTitle>테스트 케이스</SectionTitle>
            </SectionHeader>
            <TestCaseEditor
              testCases={algoDraft.draft.testCases}
              onChange={(next) => algoDraft.updateField('testCases', next)}
            />
          </Section>

          <Section>
            <SectionHeader>
              <SectionTitle>AI 에이전트 정책</SectionTitle>
            </SectionHeader>
            <AiPolicyFields
              policy={algoDraft.draft.aiPolicy}
              onChange={(next) => algoDraft.updateField('aiPolicy', next)}
            />
          </Section>
        </>
      )}

      {type !== '' && (
        <Footer>
          {onDelete && (
            <Button type="button" variant="ghost" onClick={onDelete} disabled={isSaving}>
              삭제
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!isValid || isSaving}>
            {isSaving ? '저장 중…' : '저장'}
          </Button>
        </Footer>
      )}
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

const IndicatorCard = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  align-items: flex-start;
`;

const IndicatorIcon = styled.span`
  font-size: 24px;
  line-height: 1;
`;

const IndicatorContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const IndicatorTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const IndicatorDesc = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.5;
`;
