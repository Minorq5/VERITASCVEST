'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { FormAlert } from '@/features/auth/auth-card';
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors';
import { passwordSchema } from '@/lib/auth/validation';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { getSupabase } from '@/lib/supabase/client';
import { toast } from '@/stores/toasts';

/**
 * New password twice. If the sign-in is older than a day, Supabase asks for
 * proof: a 6-digit code goes to the inbox and is sent along as a nonce.
 */
export function ChangePasswordDialog({ email, context }: { email: string; context: string[] }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
    code?: string;
  }>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const { pending, run } = useGuardedSubmit();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword('');
      setConfirm('');
      setCode('');
      setStep('password');
      setFieldErrors({});
      setError(null);
    }
  }

  function done() {
    toast.success(t('settings.account.passwordChanged'));
    reset(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 'password') {
      const errors: typeof fieldErrors = {};
      if (!passwordSchema.safeParse(password).success)
        errors.password = t('auth.errors.passwordRules');
      if (password !== confirm) errors.confirm = t('auth.reset.mismatch');
      setFieldErrors(errors);
      if (Object.keys(errors).length) return;
      void run(async () => {
        setError(null);
        const supabase = getSupabase();
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (!updateError) return done();
        if (authErrorKey(updateError) === 'reauthenticationNeeded') {
          const { error: reauthError } = await supabase.auth.reauthenticate();
          if (reauthError) {
            setError(authErrorKey(reauthError));
            return;
          }
          setStep('code');
          return;
        }
        setError(authErrorKey(updateError));
      });
      return;
    }
    const nonce = code.replace(/\D/g, '');
    if (nonce.length !== 6) {
      setFieldErrors({ code: t('auth.errors.invalidCode') });
      return;
    }
    setFieldErrors({});
    void run(async () => {
      setError(null);
      const { error: updateError } = await getSupabase().auth.updateUser({ password, nonce });
      if (updateError) {
        setError(authErrorKey(updateError));
        return;
      }
      done();
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={reset}
      trigger={<Button size="sm">{t('settings.account.passwordChange')}</Button>}
      title={
        step === 'code' ? t('settings.account.reauthTitle') : t('settings.account.passwordChange')
      }
      description={step === 'code' ? t('settings.account.reauthText', { email }) : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => reset(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="change-password" loading={pending}>
            {step === 'code' ? t('settings.account.confirm') : t('settings.account.passwordChange')}
          </Button>
        </>
      }
    >
      <form id="change-password" noValidate onSubmit={submit} className="flex flex-col gap-4">
        {error && <FormAlert>{t(`auth.errors.${error}`)}</FormAlert>}
        {step === 'password' ? (
          <>
            {/* Lets password managers attach the new password to the right account. */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              hidden
            />
            <Field label={t('settings.account.newPassword')} error={fieldErrors.password}>
              <PasswordInput
                meter
                context={context}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t('settings.account.confirmPassword')} error={fieldErrors.confirm}>
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </>
        ) : (
          <Field label={t('settings.account.code')} error={fieldErrors.code}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="font-mono tracking-[0.3em]"
              maxLength={7}
            />
          </Field>
        )}
      </form>
    </ResponsiveDialog>
  );
}
