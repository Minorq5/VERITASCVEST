/** Where signed-in people land. */
export const APP_HOME = '/today';

/** Route prefixes that require a signed-in account (without the locale). */
export const PROTECTED_PREFIXES = [
  '/onboarding',
  '/profile',
  '/settings',
  '/inbox',
  '/today',
  '/tomorrow',
  '/week',
  '/overdue',
  '/completed',
  '/trash',
  '/projects',
  '/tags',
  '/lists',
] as const;

export function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Only same-site relative paths may be used as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback: string = APP_HOME): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
