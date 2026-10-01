'use client';

import { KeyRound, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors';
import { confirmUrl } from '@/lib/auth/redirect';
import { emailSchema } from '@/lib/auth/validation';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { emailLinkClient } from '@/lib/supabase/email-links';
import { AuthCard, FormAlert } from './auth-card';

export function ForgotForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const submit = useGuardedSubmit();

  const back = (
    <Link href="/login" className="focus-ring rounded-xs font-semibold text-accent hover-ok:underline">
      {t('forgot.back')}
    </Link>
  );

  if (sentTo) {
    return (
      <AuthCard icon={<MailCheck />} title={t('forgot.sentTitle')} subtitle={t('forgot.sentText', { email: sentTo })} footer={back} />
    );
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!emailSchema.safeParse(value).success) {
      setFieldError(t('errors.invalidEmail'));
      return;
    }
    setFieldError(undefined);
    void submit.run(async () => {
      setError(null);
      const { error: resetError } = await emailLinkClient().auth.resetPasswordForEmail(value, {
        redirectTo: confirmUrl(locale, 'recovery'),
      });
      if (resetError) {
        setError(authErrorKey(resetError));
        return;
      }
      // Same answer whether or not the account exists: no address probing.
      setSentTo(value);
    });
  };

  return (
    <AuthCard icon={<KeyRound />} title={t('forgot.title')} subtitle={t('forgot.subtitle')} footer={back}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
        <Field label={t('email')} error={fieldError}>
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
        <Button type="submit" variant="primary" size="lg" block loading={submit.pending}>
          {t('forgot.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
