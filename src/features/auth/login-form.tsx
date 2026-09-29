'use client';

import { ArrowRight, MailWarning } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Link, useRouter } from '@/i18n/navigation';
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors';
import { confirmUrl, rememberPendingEmail } from '@/lib/auth/redirect';
import { emailSchema } from '@/lib/auth/validation';
import { safeNext } from '@/lib/config/routes';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toasts';
import { AuthCard, FormAlert } from './auth-card';

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const status = useSession((s) => s.status);
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const submit = useGuardedSubmit();
  const resend = useGuardedSubmit();

  // Already signed in (e.g. opened /login in a second tab): go straight in.
  useEffect(() => {
    if (status === 'signed-in') router.replace(next);
  }, [status, next, router]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!emailSchema.safeParse(email.trim()).success) errors.email = t('errors.invalidEmail');
    if (!password) errors.password = t('errors.required');
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    void submit.run(async () => {
      setError(null);
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(authErrorKey(signInError));
        return;
      }
      router.replace(next);
    });
  };

  const onResend = () =>
    resend.run(async () => {
      const { error: resendError } = await getSupabase().auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: confirmUrl(locale) },
      });
      if (resendError) {
        toast.error(t(`errors.${authErrorKey(resendError)}`));
        return;
      }
      rememberPendingEmail(email.trim());
      toast.success(t('login.resent'));
    });

  return (
    <AuthCard
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link href={{ pathname: '/register', query: params.get('next') ? { next } : {} }} className="focus-ring rounded-xs font-semibold text-accent hover-ok:underline">
            {t('login.register')}
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error === 'emailNotConfirmed' ? (
          <FormAlert tone="info">
            <div className="flex items-start gap-3">
              <MailWarning aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-fg">{t('login.unconfirmedTitle')}</p>
                <p className="text-fg-2">{t('login.unconfirmedText')}</p>
                <Button size="sm" variant="secondary" className="self-start" loading={resend.pending} onClick={onResend}>
                  {t('login.resend')}
                </Button>
              </div>
            </div>
          </FormAlert>
        ) : (
          error && <FormAlert>{t(`errors.${error}`)}</FormAlert>
        )}
        <Field label={t('email')} error={fieldErrors.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t('password')} error={fieldErrors.password}>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="focus-ring rounded-xs text-sm text-fg-2 hover-ok:text-accent">
            {t('login.forgot')}
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" block loading={submit.pending} trailing={<ArrowRight />}>
          {t('login.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
