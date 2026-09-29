'use client';

import { ArrowRight } from 'lucide-react';
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
import { emailSchema, normalizeUsername, passwordSchema, usernameSchema } from '@/lib/auth/validation';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';
import { AuthCard, FormAlert } from './auth-card';
import { useUsernameAvailability } from './use-username-availability';
import { UsernameField } from './username-field';

export function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const status = useSession((s) => s.status);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; username?: string; password?: string }>({});
  const availability = useUsernameAvailability(username);
  const submit = useGuardedSubmit();

  useEffect(() => {
    if (status === 'signed-in') router.replace('/onboarding');
  }, [status, router]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!emailSchema.safeParse(email.trim()).success) errors.email = t('errors.invalidEmail');
    if (!usernameSchema.safeParse(username).success) errors.username = t('errors.invalidUsername');
    else if (availability === 'taken') errors.username = t('errors.usernameTaken');
    if (!passwordSchema.safeParse(password).success) errors.password = t('errors.passwordRules');
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    void submit.run(async () => {
      setError(null);
      const cleanUsername = normalizeUsername(username);
      const { data, error: signUpError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: confirmUrl(locale),
          data: {
            username: cleanUsername,
            display_name: cleanUsername,
            locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      });
      if (signUpError) {
        const key = authErrorKey(signUpError);
        if (key === 'usernameTaken' || key === 'invalidUsername') {
          setFieldErrors({ username: t(`errors.${key}`) });
        } else if (key === 'weakPassword') {
          setFieldErrors({ password: t('errors.weakPassword') });
        } else {
          setError(key);
        }
        return;
      }
      if (data.session) {
        router.replace('/onboarding');
        return;
      }
      rememberPendingEmail(email.trim());
      router.push('/check-email');
    });
  };

  return (
    <AuthCard
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <>
          {t('register.haveAccount')}{' '}
          <Link
            href={{ pathname: '/login', query: params.get('next') ? { next: params.get('next')! } : {} }}
            className="focus-ring rounded-xs font-semibold text-accent hover-ok:underline"
          >
            {t('register.login')}
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
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
        <UsernameField
          label={t('register.username')}
          hint={t('register.usernameHint')}
          value={username}
          onChange={(v) => {
            setUsername(v);
            if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: undefined }));
          }}
          status={availability}
          error={fieldErrors.username}
        />
        <Field label={t('password')} hint={t('register.passwordHint')} error={fieldErrors.password}>
          <PasswordInput
            meter
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            context={[email.split('@')[0] ?? '', username]}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={submit.pending} trailing={<ArrowRight />}>
          {t('register.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
