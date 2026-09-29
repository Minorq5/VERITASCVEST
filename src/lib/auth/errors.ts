/**
 * Turns Supabase Auth / PostgREST errors into translation keys under
 * `auth.errors.*`. Raw server messages are never shown to people.
 */
export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'weakPassword'
  | 'samePassword'
  | 'emailRateLimit'
  | 'tooManyRequests'
  | 'invalidEmail'
  | 'invalidUsername'
  | 'usernameTaken'
  | 'emailTaken'
  | 'linkExpired'
  | 'invalidCode'
  | 'reauthenticationNeeded'
  | 'network'
  | 'signupDisabled'
  | 'unknown';

interface ErrorLike {
  code?: string | null;
  status?: number;
  message?: string;
  name?: string;
}

const byCode: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  over_email_send_rate_limit: 'emailRateLimit',
  over_request_rate_limit: 'tooManyRequests',
  over_sms_send_rate_limit: 'tooManyRequests',
  email_address_invalid: 'invalidEmail',
  email_address_not_authorized: 'invalidEmail',
  validation_failed: 'invalidEmail',
  otp_expired: 'linkExpired',
  flow_state_expired: 'linkExpired',
  bad_code_verifier: 'linkExpired',
  reauthentication_not_valid: 'invalidCode',
  reauthentication_needed: 'reauthenticationNeeded',
  signup_disabled: 'signupDisabled',
  email_provider_disabled: 'signupDisabled',
  email_exists: 'emailTaken',
  user_already_exists: 'emailTaken',
  PT429: 'tooManyRequests',
  '23514': 'invalidUsername',
  '23505': 'usernameTaken',
};

export function authErrorKey(error: unknown): AuthErrorKey {
  if (!error) return 'unknown';
  const e = error as ErrorLike;
  if (e.name === 'AuthRetryableFetchError' || (error instanceof TypeError && /fetch/i.test(error.message))) {
    return 'network';
  }
  if (e.code && byCode[e.code]) return byCode[e.code]!;
  const message = (e.message ?? '').toLowerCase();
  if (message.includes('invalid_username')) return 'invalidUsername';
  if (message.includes('username_taken') || message.includes('database error saving new user')) {
    return 'usernameTaken';
  }
  if (message.includes('rate_limited') || e.status === 429) return 'tooManyRequests';
  if (message.includes('invalid login credentials')) return 'invalidCredentials';
  if (message.includes('email not confirmed')) return 'emailNotConfirmed';
  if (message.includes('failed to fetch') || message.includes('network')) return 'network';
  return 'unknown';
}
