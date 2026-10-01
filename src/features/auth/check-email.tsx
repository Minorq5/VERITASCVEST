'use client';

import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { authErrorKey } from '@/lib/auth/errors';
import { confirmUrl, readPendingEmail } from '@/lib/auth/redirect';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { emailLinkClient } from '@/lib/supabase/email-links';
import { toast } from '@/stores/toasts';
import { AuthCard } from './auth-card';

const COOLDOWN = 60;

export function CheckEmail() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const email = useSyncExternalStore(
    () => () => undefined,
    () => readPendingEmail(),
    () => null,
  );
  const [cooldown, setCooldown] = useState(COOLDOWN);
  const resend = useGuardedSubmit();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const onResend = () =>
    resend.run(async () => {
      if (!email) return;
      const { error } = await emailLinkClient().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: confirmUrl(locale, 'signup') },
      });
      if (error) {
        toast.error(t(`errors.${authErrorKey(error)}`));
        return;
      }
      toast.success(t('checkEmail.sent'));
      setCooldown(COOLDOWN);
    });

  return (
    <AuthCard
      icon={<MailCheck />}
      title={t('checkEmail.title')}
      subtitle={email ? t('checkEmail.text', { email }) : t('checkEmail.textNoEmail')}
      footer={
        <Link href="/login" className="focus-ring rounded-xs font-semibold text-accent hover-ok:underline">
          {t('checkEmail.back')}
        </Link>
      }
    >
      <p className="text-sm text-fg-3">{t('checkEmail.noEmail')}</p>
      {email && (
        <Button
          variant="secondary"
          block
          className="mt-5"
          disabled={cooldown > 0}
          loading={resend.pending}
          onClick={onResend}
        >
          {cooldown > 0 ? t('checkEmail.resendIn', { seconds: cooldown }) : t('checkEmail.resend')}
        </Button>
      )}
    </AuthCard>
  );
}
