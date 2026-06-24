/**
 * GradingDashboardView.tsx — 교수 채점 대시보드 (진입점 / 스캐폴드)
 *
 * 특정 과제의 채점 현황을 보여줄 교수용 화면. 현재는 제출(submission) 영속 모델이
 * 없어(인증·교수/학생 분리·다중 사용자·제출 저장은 MVP 범위 밖) 학생별 제출 목록은
 * 비어 있으며, 진입점 + 채점 기준(루브릭) 요약만 제공하는 스캐폴드다. 제출 영속·집계는
 * 후속 단계(새 저장소 도입 — Blocking 결정)로 미룬다(docs/spec-webcontainer.md §13).
 *
 * 과제는 props로 주입받는다(DI) — 데이터 조회는 라우트 진입점이 담당한다.
 *
 * 사용처: app/author/challenge/[challengeId]/submissions/page.tsx
 */
'use client';

import Link from 'next/link';
import styled from 'styled-components';
import type { ChallengeProblem } from '@/shared/core/types';
import { Panel } from '@/shared/components/ui/Panel';

// ── Types ─────────────────────────────────────────────────────────────────

interface GradingDashboardViewProps {
  challenge: ChallengeProblem;
}

// ── Component ─────────────────────────────────────────────────────────────

export function GradingDashboardView({ challenge }: GradingDashboardViewProps) {
  const { rubric, aiPolicy } = challenge;
  const maxScoreSum = rubric.criteria.reduce(
    (sum, criterion) => sum + criterion.maxScore,
    0,
  );

  return (
    <Layout>
      <Header>
        <BackLink href="/author/challenge">← 과제 출제로 돌아가기</BackLink>
        <Title>채점 대시보드 — {challenge.title || '(제목 없음)'}</Title>
        <Subtitle>
          이 과제의 학생 제출·점수를 모아 볼 화면입니다. 자세한 채점 기준은 아래 루브릭을
          참고하세요.
        </Subtitle>
      </Header>

      <Grid>
        <Panel title="채점 기준 (루브릭)">
          <RubricMeta>
            가중치 — 자동 테스트 {formatWeight(rubric.weights.tests)} · AI 루브릭{' '}
            {formatWeight(rubric.weights.rubric)} / 루브릭 만점 합 {maxScoreSum}점
          </RubricMeta>
          <CriterionList>
            {rubric.criteria.map((criterion, index) => (
              <CriterionRow key={criterion.id}>
                <CriterionDesc>
                  #{index + 1} {criterion.description || '(설명 없음)'}
                </CriterionDesc>
                <CriterionScore>{criterion.maxScore}점</CriterionScore>
              </CriterionRow>
            ))}
            {rubric.criteria.length === 0 && (
              <Empty>등록된 루브릭 항목이 없습니다.</Empty>
            )}
          </CriterionList>
          <AiMeta>
            AI 정책 — 모델 {aiPolicy.model} · 질문 {aiPolicy.maxQuestions}회 · 토큰{' '}
            {aiPolicy.maxTokens.toLocaleString()}
          </AiMeta>
        </Panel>

        <Panel title="학생 제출">
          <PlaceholderBox>
            <PlaceholderTitle>아직 표시할 제출이 없습니다</PlaceholderTitle>
            <PlaceholderBody>
              현재 채점은 학생 본인 화면에서 1회성으로 이뤄지며, 제출·점수를 저장하지
              않습니다. 학생별 제출 목록·점수·재채점은 <strong>제출 영속 저장소</strong>가
              도입되면 이 화면에 표시됩니다(인증·다중 사용자와 함께 정해질 후속 단계).
            </PlaceholderBody>
          </PlaceholderBox>
        </Panel>
      </Grid>
    </Layout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatWeight(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

// ── Styled Components ─────────────────────────────────────────────────────

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  height: 100%;
  min-height: 0;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const BackLink = styled(Link)`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.primary};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
  color: ${({ theme }) => theme.colors.text};
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 0;
  flex: 1;
`;

const RubricMeta = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CriterionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const CriterionRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

const CriterionDesc = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.text};
`;

const CriterionScore = styled.span`
  font-size: ${({ theme }) => theme.font.sizeSm};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;
`;

const AiMeta = styled.p`
  margin: ${({ theme }) => theme.spacing.md} 0 0;
  font-size: ${({ theme }) => theme.font.sizeXs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PlaceholderBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const PlaceholderTitle = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeMd};
  font-weight: ${({ theme }) => theme.font.weightBold};
  color: ${({ theme }) => theme.colors.text};
`;

const PlaceholderBody = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Empty = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};
`;
