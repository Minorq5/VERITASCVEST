'use client';

/** Absolute URL of the email confirmation handler for the current language. */
export function confirmUrl(locale: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
  return `${origin}/${locale}/auth/confirm`;
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
