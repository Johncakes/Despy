/**
 * seed-admin.ts — 최초 관리자 계정 시드 스크립트
 *
 * 자가 회원가입은 모두 'student'로 시작하므로, 첫 관리자는 이 스크립트로 만든다.
 * ADMIN_SEED_EMAIL/PASSWORD/NAME 환경변수를 읽어 관리자(admin) 계정을 생성한다.
 * 이미 같은 이메일이 있으면 비밀번호는 건드리지 않고 역할만 admin으로 승격한다(멱등).
 *
 * 실행: npm run seed:admin  (tsx --env-file=.env.local 로 .env.local을 로드)
 * 사용처: 운영 부트스트랩(1회). 생성 후 시드 환경변수는 비워도 된다.
 */
import { getClient } from '@/shared/lib/db/mongodb';
import {
  findUserByEmail,
  createUser,
  updateUserRole,
} from '@/shared/lib/db/users';
import { hashPassword } from '@/shared/lib/auth/password';

async function main(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME || '관리자';

  if (!email || !password) {
    throw new Error(
      'ADMIN_SEED_EMAIL과 ADMIN_SEED_PASSWORD를 .env.local에 설정하세요.',
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.role === 'admin') {
      console.warn(`[seed:admin] 이미 관리자입니다: ${email} (변경 없음)`);
    } else {
      await updateUserRole(existing._id.toHexString(), 'admin');
      console.warn(`[seed:admin] 기존 사용자를 관리자로 승격: ${email}`);
    }
  } else {
    const passwordHash = await hashPassword(password);
    await createUser({ email, name, passwordHash, role: 'admin' });
    console.warn(`[seed:admin] 관리자 계정 생성 완료: ${email}`);
  }

  // Mongo 연결을 닫아 프로세스가 종료되게 한다.
  const client = await getClient();
  await client.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[seed:admin] 실패:', error);
    process.exit(1);
  });
