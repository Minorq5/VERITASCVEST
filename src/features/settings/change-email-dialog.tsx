'use client';

import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { FormAlert } from '@/features/auth/auth-card';
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors';
import { confirmUrl } from '@/lib/auth/redirect';
import { emailSchema } from '@/lib/auth/validation';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { getSupabase } from '@/lib/supabase/client';

export function ChangeEmailDialog({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sent, setSent] = useState(false);
  const { pending, run } = useGuardedSubmit();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setEmail('');
      setFieldError(undefined);
      setError(null);
      setSent(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setFieldError(t('auth.errors.invalidEmail'));
      return;
    }
    if (parsed.data === currentEmail.toLowerCase()) {
      setFieldError(t('settings.account.emailSame'));
      return;
    }
    setFieldError(undefined);
    void run(async () => {
      setError(null);
      const { error: updateError } = await getSupabase().auth.updateUser(
        { email: parsed.data },
        { emailRedirectTo: confirmUrl(locale) },
      );
      if (updateError) {
        setError(authErrorKey(updateError));
        return;
      }
      setSent(true);
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={reset}
      trigger={<Button size="sm">{t('settings.account.emailChange')}</Button>}
      title={t('settings.account.emailChange')}
      description={sent ? undefined : t('settings.account.emailCurrent', { email: currentEmail })}
      size="sm"
      footer={
        sent ? (
          <Button variant="primary" onClick={() => reset(false)}>
            {t('common.done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => reset(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit" form="change-email" loading={pending}>
              {t('settings.account.emailChange')}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <MailCheck className="size-10 text-accent" aria-hidden />
          <p className="text-base text-fg-2">{t('settings.account.emailChangeSent')}</p>
        </div>
      ) : (
        <form id="change-email" noValidate onSubmit={submit} className="flex flex-col gap-4">
          {error && <FormAlert>{t(`auth.errors.${error}`)}</FormAlert>}
          <Field label={t('settings.account.newEmail')} error={fieldError}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </form>
      )}
    </ResponsiveDialog>
  );
}
