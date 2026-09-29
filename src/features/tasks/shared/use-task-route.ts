'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

/** The open task lives in the address (`?task=…`): links and the back button work. */
export function useTaskRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get('task');

  const open = useCallback(
    (id: string) => {
      if (id === openId) return;
      const method = openId ? router.replace : router.push;
      method({ pathname, query: { task: id } }, { scroll: false });
    },
    [openId, pathname, router],
  );

  const close = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  return { openId, open, close };
}
