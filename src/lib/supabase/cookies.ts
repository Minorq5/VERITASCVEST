/**
 * The session cookie written by @supabase/ssr is named `sb-<ref>-auth-token`
 * (possibly split into `.0`, `.1` chunks). Its presence is a cheap hint used
 * by the proxy; real authorization always happens in the database (RLS).
 */
export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (/^sb-[\w-]+-auth-token(\.\d+)?$/.test(name)) return true;
  }
  return false;
}
