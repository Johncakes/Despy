/**
 * password.ts — 비밀번호 해시/검증 (bcryptjs)
 *
 * 평문 비밀번호는 절대 저장하지 않는다. 가입 시 해시해 UserDoc.passwordHash에
 * 저장하고, 로그인 시 입력 비밀번호를 해시와 비교한다. 순수 JS 구현(bcryptjs)이라
 * 네이티브 빌드가 필요 없다.
 *
 * 사용처: app/api/auth/signup·login, scripts/seed-admin.ts (서버 전용)
 */
import bcrypt from 'bcryptjs';

/** bcrypt 작업 인자(라운드). 12면 보안/지연 균형이 무난하다. */
const SALT_ROUNDS = 12;

/** 평문 비밀번호를 해시한다. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** 평문 비밀번호가 해시와 일치하는지 검증한다. */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
