'use client';

export type EmailFlow = 'signup' | 'recovery' | 'email_change';

/**
 * Absolute URL of the email link handler for the current language. The flow
 * rides along, so the handler knows what the letter was even when the link
 * itself does not say (a code made for another browser).
 */
export function confirmUrl(locale: string, flow?: EmailFlow): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
  return `${origin}/${locale}/auth/confirm${flow ? `?flow=${flow}` : ''}`;
}

const PENDING_EMAIL = 'vt:pending-email';

export function rememberPendingEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL, email);
  } catch {
    /* private mode: the check-email page simply shows a generic text */
  }
}

export function readPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(PENDING_EMAIL);
  } catch {
    return null;
  }
}
