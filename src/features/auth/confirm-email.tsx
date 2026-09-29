'use client';

import type { EmailOtpType } from '@supabase/supabase-js';
import { CircleCheck, CircleX, Clock3, MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Link, useRouter } from '@/i18n/navigation';
import { authErrorKey } from '@/lib/auth/errors';
import { APP_HOME } from '@/lib/config/routes';
import { getSupabase } from '@/lib/supabase/client';
import { AuthCard } from './auth-card';

type State = 'verifying' | 'confirmed' | 'email-changed' | 'email-partial' | 'expired' | 'invalid';

const OTP_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change', 'invite', 'magiclink'];

/**
 * Handles links from emails: `?token_hash=…&type=…` (our templates) and
 * `?code=…` (the default Supabase templates, same browser only).
 */
export function ConfirmEmail() {
  const t = useTranslations('auth.confirm');
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>('verifying');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    const code = params.get('code');
    const supabase = getSupabase();

    const verify = async (): Promise<{ error: unknown; signedIn: boolean }> => {
      if (tokenHash && type && OTP_TYPES.includes(type)) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        return { error, signedIn: Boolean(data.session) };
      }
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        return { error, signedIn: Boolean(data.session) };
      }
      return { error: { code: 'invalid' }, signedIn: false };
    };

    void verify().then(({ error, signedIn }) => {
      if (error) {
        setState(authErrorKey(error) === 'linkExpired' ? 'expired' : 'invalid');
        return;
      }
      if (type === 'recovery') {
        router.replace('/reset-password');
      } else if (type === 'email_change') {
        // With confirmation on both addresses the first link only records consent.
        setState(signedIn ? 'email-changed' : 'email-partial');
      } else {
        setState('confirmed');
        window.setTimeout(() => router.replace('/onboarding'), 1400);
      }
    });
  }, [params, router]);

  if (state === 'verifying') {
    return (
      <AuthCard title={t('verifying')}>
        <div className="flex justify-center py-4 text-accent">
          <Spinner size={36} label={t('verifying')} />
        </div>
      </AuthCard>
    );
  }
  if (state === 'email-partial') {
    return (
      <AuthCard icon={<MailCheck />} title={t('emailPartialTitle')} subtitle={t('emailPartialText')}>
        <Button asChild variant="secondary" size="lg" block>
          <Link href="/settings/account">{t('continue')}</Link>
        </Button>
      </AuthCard>
    );
  }
  if (state === 'confirmed' || state === 'email-changed') {
    const changed = state === 'email-changed';
    return (
      <AuthCard
        icon={<CircleCheck className="text-success" />}
        title={changed ? t('emailChangedTitle') : t('successTitle')}
        subtitle={changed ? t('emailChangedText') : t('successText')}
      >
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => router.replace(changed ? '/settings/account' : '/onboarding')}
        >
          {t('continue')}
        </Button>
      </AuthCard>
    );
  }
  const expired = state === 'expired';
  return (
    <AuthCard
      icon={expired ? <Clock3 className="text-warning" /> : <CircleX className="text-danger" />}
      title={expired ? t('expiredTitle') : t('invalidTitle')}
      subtitle={expired ? t('expiredText') : t('invalidText')}
    >
      <Button asChild variant="primary" size="lg" block>
        <Link href={{ pathname: '/login', query: { next: APP_HOME } }}>{t('toLogin')}</Link>
      </Button>
    </AuthCard>
  );
}
