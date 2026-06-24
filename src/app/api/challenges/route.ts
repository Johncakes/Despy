/**
 * route.ts (/api/challenges) — 과제 목록·생성 (M4 서버 영속)
 *
 * GET: 역할별 필터링 목록. 학생은 published만 + 민감정보 제거 DTO(StudentChallenge),
 *   교수는 본인 출제분(전체 ChallengeProblem), admin은 전체. POST: 교수/admin이 과제를
 *   생성한다(authorId=요청자, 기본 상태 'draft').
 *
 * 사용처: features/author(목록·생성), 홈·features/solve(학생 published 목록)
 */
import {
  listChallengesByAuthor,
  listAllChallenges,
  listPublishedChallenges,
  createChallenge,
  type ChallengeInput,
} from '@/shared/lib/db/challenges';
import {
  requireUser,
  requireRole,
  authErrorToResponse,
} from '@/shared/lib/auth/session';
import { logger } from '@/shared/lib/utils/logger';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    if (user.role === 'admin') {
      return Response.json({ challenges: await listAllChallenges() });
    }
    if (user.role === 'professor') {
      return Response.json({ challenges: await listChallengesByAuthor(user.id) });
    }
    // student: published만, 민감정보(testFiles·rubric·systemPrompt·ml.seed/testDataPath) 제거.
    return Response.json({ challenges: await listPublishedChallenges() });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('과제 목록 조회 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireRole(['professor', 'admin']);

    let input: ChallengeInput;
    try {
      input = (await req.json()) as ChallengeInput;
    } catch {
      return Response.json(
        { error: '요청 본문(JSON) 파싱에 실패했습니다.' },
        { status: 400 },
      );
    }
    if (!input?.title?.trim()) {
      return Response.json({ error: '과제 제목을 입력하세요.' }, { status: 400 });
    }

    // createChallenge는 알려진 출제 필드만 복사하므로 잉여 필드는 저장되지 않는다.
    const challenge = await createChallenge(user.id, input);
    return Response.json({ challenge }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorToResponse(error);
    if (authResponse) return authResponse;
    logger.error('과제 생성 실패', error);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
