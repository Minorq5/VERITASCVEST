'use client';

import type { EmailOtpType } from '@supabase/supabase-js';
import { CircleCheck, CircleX, Clock3, KeyRound, MailCheck } from 'lucide-react';
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

type State =
  | 'verifying'
  | 'confirmed'
  | 'confirmed-elsewhere'
  | 'recovery-elsewhere'
  | 'email-changed'
  | 'email-partial'
  | 'expired'
  | 'invalid';

const OTP_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change', 'invite', 'magiclink'];

type Outcome = { error: unknown; signedIn: boolean; elsewhere?: boolean; partial?: boolean };

const missingVerifier = (error: unknown) => {
  const e = error as { code?: string; name?: string } | null;
  return e?.code === 'pkce_code_verifier_not_found' || e?.name === 'AuthPKCECodeVerifierMissingError';
};

/**
 * Handles links from emails, whichever way they arrive:
 * - `?token_hash=…&type=…` — our own letter templates;
 * - `#access_token=…&refresh_token=…&type=…` — Supabase's default templates
 *   (the app asks for links without PKCE, so they work on any device);
 * - `?code=…` — an older PKCE link: only the browser that asked can finish it,
 *   anywhere else the address is already confirmed and the person just signs in;
 * - `error_code=otp_expired` — the link was used or is too old.
 * `flow` (added by the app to the return address) says what the letter was.
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
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Tokens never stay in the address bar or in the history.
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    const tokenHash = params.get('token_hash');
    const type = (params.get('type') ?? hash.get('type')) as EmailOtpType | null;
    const flow = params.get('flow') ?? type;
    const code = params.get('code');
    const failure = hash.get('error_code') ?? params.get('error_code') ?? hash.get('error') ?? params.get('error');
    const supabase = getSupabase();

    const verify = async (): Promise<Outcome> => {
      if (failure) return { error: { code: failure === 'otp_expired' ? 'otp_expired' : 'invalid' }, signedIn: false };
      const access = hash.get('access_token');
      const refresh = hash.get('refresh_token');
      if (access && refresh) {
        const { data, error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
        return { error, signedIn: Boolean(data.session) };
      }
      // The first of two links when an address changes: accepted, the other one is still due.
      if (hash.get('message')) return { error: null, signedIn: false, partial: true };
      if (tokenHash && type && OTP_TYPES.includes(type)) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        return { error, signedIn: Boolean(data.session) };
      }
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && missingVerifier(error)) return { error: null, signedIn: false, elsewhere: true };
        return { error, signedIn: Boolean(data.session) };
      }
      return { error: { code: 'invalid' }, signedIn: false };
    };

    void verify().then(({ error, signedIn, elsewhere, partial }) => {
      if (error) {
        setState(authErrorKey(error) === 'linkExpired' ? 'expired' : 'invalid');
        return;
      }
      if (flow === 'recovery') {
        if (elsewhere || !signedIn) setState('recovery-elsewhere');
        else router.replace('/reset-password');
      } else if (flow === 'email_change' || partial) {
        // With confirmation on both addresses the first link only records consent.
        setState(signedIn ? 'email-changed' : 'email-partial');
      } else if (elsewhere || !signedIn) {
        // The address is confirmed; this device simply is not signed in.
        setState('confirmed-elsewhere');
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
  if (state === 'confirmed-elsewhere') {
    return (
      <AuthCard icon={<CircleCheck className="text-success" />} title={t('successTitle')} subtitle={t('elsewhereText')}>
        <Button asChild variant="primary" size="lg" block>
          <Link href={{ pathname: '/login', query: { next: APP_HOME } }}>{t('signIn')}</Link>
        </Button>
      </AuthCard>
    );
  }
  if (state === 'recovery-elsewhere') {
    return (
      <AuthCard icon={<KeyRound />} title={t('recoveryElsewhereTitle')} subtitle={t('recoveryElsewhereText')}>
        <Button asChild variant="primary" size="lg" block>
          <Link href="/forgot-password">{t('newLink')}</Link>
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
