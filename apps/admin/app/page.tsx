'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { adminSignInSchema } from '@everycation/shared';
import { Button, Field, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

type Form = z.infer<typeof adminSignInSchema>;

export default function SignIn() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(adminSignInSchema) });
  const [error, setError] = useState('');
  const submit = handleSubmit(async (v) => {
    setError('');
    try { await signIn(v.email, v.password, v.code.replace(/\s/g, '')); router.push('/overview'); }
    catch (e) { setError(errorMessage(e)); }
  });
  return (
    <div className="flex min-h-screen flex-wrap">
      <section className="flex flex-[1_1_420px] flex-col justify-between gap-10 bg-navy p-8 text-white sm:p-14">
        <Image src="/brand/everycation-logo-horizontal-white.svg" alt="EveryCation" width={190} height={44} priority />
        <div className="flex max-w-md flex-col gap-4">
          <span className="text-xs font-semibold tracking-[0.12em] text-gold">ADMIN CONSOLE</span>
          <h1 className="text-4xl leading-[1.15] font-semibold">Keep every trip safe, honest and paid on time.</h1>
          <p className="text-navy-soft">Review advice, moderate the community, run payouts and manage the shop from one place.</p>
        </div>
        <p className="text-[13px] text-navy-soft">Staff only. Every action is recorded in the audit log.</p>
      </section>
      <main className="flex flex-[1_1_420px] items-center justify-center bg-white p-8">
        <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-5">
          <div><h2 className="text-2xl font-semibold">Sign in</h2><p className="text-sm text-ink-muted">Use your EveryCation staff account.</p></div>
          <Field label="Work email" error={errors.email?.message}><Input type="email" autoComplete="username" placeholder="you@everycation.app" aria-invalid={!!errors.email} {...register('email')} /></Field>
          <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} /></Field>
          <Field label="6-digit code from your authenticator app" error={errors.code?.message}><Input inputMode="numeric" autoComplete="one-time-code" placeholder="000 000" aria-invalid={!!errors.code} {...register('code')} /></Field>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>{isSubmitting ? 'SIGNING IN…' : 'SIGN IN'}</Button>
          <a href="mailto:security@everycation.app" className="text-center text-[13px] font-semibold no-underline">Lost access to your authenticator?</a>
        </form>
      </main>
    </div>
  );
}
