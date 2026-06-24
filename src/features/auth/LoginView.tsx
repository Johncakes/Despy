/**
 * LoginView.tsx — 로그인 화면
 *
 * 이메일/비밀번호로 로그인한다. 성공 시 ?next 파라미터(보호 라우트에서 리다이렉트된
 * 원래 목적지)로 이동하고, 없으면 홈으로 보낸다. 인증 상태는 useLogin mutation이
 * me 캐시를 갱신해 앱 전역에 반영된다.
 *
 * 사용처: app/login/page.tsx
 */
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styled from 'styled-components';
import { useLogin } from '@/shared/core/queries/authQueries';
import { Button } from '@/shared/components/ui/Button';
import { Field, TextInput } from '@/shared/components/ui/Field';

// ── Component ─────────────────────────────────────────────────────────────

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          const next = searchParams.get('next');
          router.push(next && next.startsWith('/') ? next : '/');
          router.refresh();
        },
      },
    );
  };

  return (
    <Centered>
      <Card onSubmit={onSubmit}>
        <Heading>로그인</Heading>
        <Field label="이메일" htmlFor="login-email">
          <TextInput
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="비밀번호" htmlFor="login-password">
          <TextInput
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        {login.isError && <ErrorText>{login.error.message}</ErrorText>}

        <Button type="submit" variant="primary" disabled={login.isPending}>
          {login.isPending ? '로그인 중…' : '로그인'}
        </Button>

        <Hint>
          계정이 없나요? <Link href="/signup">회원가입</Link>
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
