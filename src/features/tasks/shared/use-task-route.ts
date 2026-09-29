'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * The open task lives in the address (`?task=…`): links and the back button
 * work. The address changes through the browser's own history, which the
 * Next.js router follows without asking the server, so a task opens and
 * closes instantly, offline too.
 */
export function useTaskRoute() {
  const params = useSearchParams();
  const openId = params.get('task');

  const open = useCallback(
    (id: string) => {
      if (id === openId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('task', id);
      if (openId) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    },
    [openId],
  );

  const close = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('task');
    window.history.replaceState(null, '', url);
  }, []);

  return { openId, open, close };
}
