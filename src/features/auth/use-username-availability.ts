'use client';

import { useEffect, useState } from 'react';
import { normalizeUsername, USERNAME_PATTERN } from '@/lib/auth/validation';
import { getSupabase } from '@/lib/supabase/client';

export type UsernameStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'invalid'
  | 'reserved'
  | 'rateLimited'
  | 'error';

/**
 * Live availability of a username. Format problems are reported instantly;
 * the server is asked 350 ms after typing stops, and stale answers are ignored.
 * `current` is the person's own username (not "taken" for them).
 */
export function useUsernameAvailability(value: string, current?: string): UsernameStatus {
  const username = normalizeUsername(value);
  const [remote, setRemote] = useState<{ username: string; status: UsernameStatus } | null>(null);
  const local: UsernameStatus | null = !username
    ? 'idle'
    : !USERNAME_PATTERN.test(username)
      ? 'invalid'
      : current && username === current
        ? 'idle'
        : null;

  useEffect(() => {
    if (local) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const { data, error } = await getSupabase()
        .rpc('check_username', { p_username: username })
        .abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        setRemote({ username, status: 'error' });
        return;
      }
      const result = data as { available: boolean | null; reason: string | null };
      const status: UsernameStatus = result.available
        ? 'available'
        : result.reason === 'rate_limited'
          ? 'rateLimited'
          : result.reason === 'taken' || result.reason === 'invalid' || result.reason === 'reserved'
            ? result.reason
            : 'error';
      setRemote({ username, status });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [username, local]);

  if (local) return local;
  return remote?.username === username ? remote.status : 'checking';
}
