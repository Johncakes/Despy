/**
 * SignupView.tsx — 회원가입 화면
 *
 * 이메일/이름/비밀번호로 가입한다. 신규 가입자는 기본 역할 'student'이며, 교수
 * 권한은 관리자가 별도로 승격한다. 성공 시 세션이 발급되어 바로 로그인 상태가 되고
 * 홈으로 이동한다.
 *
 * 사용처: app/signup/page.tsx
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styled from 'styled-components';
import { useSignup } from '@/shared/core/queries/authQueries';
import { Button } from '@/shared/components/ui/Button';
import { Field, TextInput } from '@/shared/components/ui/Field';

// ── Constants ───────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 8;

// ── Component ─────────────────────────────────────────────────────────────

export function SignupView() {
  const router = useRouter();
  const signup = useSignup();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    signup.mutate(
      { email, name, password },
      {
        onSuccess: () => {
          router.push('/');
          router.refresh();
        },
      },
    );
  };

  return (
    <Centered>
      <Card onSubmit={onSubmit}>
        <Heading>회원가입</Heading>
        <Field label="이메일" htmlFor="signup-email">
          <TextInput
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="이름" htmlFor="signup-name">
          <TextInput
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field
          label="비밀번호"
          htmlFor="signup-password"
          hint={`${MIN_PASSWORD_LENGTH}자 이상`}
        >
          <TextInput
            id="signup-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        {signup.isError && <ErrorText>{signup.error.message}</ErrorText>}

        <Button type="submit" variant="primary" disabled={signup.isPending}>
          {signup.isPending ? '가입 중…' : '가입하기'}
        </Button>

        <Hint>
          이미 계정이 있나요? <Link href="/login">로그인</Link>
        </Hint>
      </Card>
    </Centered>
  );
}

// ── Styled Components ─────────────────────────────────────────────────────

const Centered = styled.main`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xl};
`;

const Card = styled.form`
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
`;

const Heading = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeLg};
  color: ${({ theme }) => theme.colors.text};
`;

const ErrorText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.danger};
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.sizeSm};
  color: ${({ theme }) => theme.colors.textMuted};

  a {
    color: ${({ theme }) => theme.colors.primary};
  }
`;
