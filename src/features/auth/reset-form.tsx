'use client';

import { Clock3, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Spinner } from '@/components/ui/spinner';
import { Link, useRouter } from '@/i18n/navigation';
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors';
import { passwordSchema } from '@/lib/auth/validation';
import { APP_HOME } from '@/lib/config/routes';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toasts';
import { AuthCard, FormAlert } from './auth-card';

export function ResetForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const status = useSession((s) => s.status);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const submit = useGuardedSubmit();

  if (status === 'loading') {
    return (
      <AuthCard title={t('reset.title')}>
        <div className="flex justify-center py-2 text-accent">
          <Spinner size={28} />
        </div>
      </AuthCard>
    );
  }

  if (status === 'signed-out') {
    return (
      <AuthCard icon={<Clock3 className="text-warning" />} title={t('reset.noSessionTitle')} subtitle={t('reset.noSessionText')}>
        <Button asChild variant="primary" size="lg" block>
          <Link href="/forgot-password">{t('reset.requestNew')}</Link>
        </Button>
      </AuthCard>
    );
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!passwordSchema.safeParse(password).success) errors.password = t('errors.passwordRules');
    if (password !== confirm) errors.confirm = t('reset.mismatch');
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    void submit.run(async () => {
      setError(null);
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) {
        setError(authErrorKey(updateError));
        return;
      }
      toast.success(t('reset.success'));
      router.replace(APP_HOME);
    });
  };

  return (
    <AuthCard icon={<LockKeyhole />} title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{t(`errors.${error}`)}</FormAlert>}
        <Field label={t('reset.password')} error={fieldErrors.password}>
          <PasswordInput meter value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label={t('reset.confirm')} error={fieldErrors.confirm}>
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={submit.pending}>
          {t('reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
