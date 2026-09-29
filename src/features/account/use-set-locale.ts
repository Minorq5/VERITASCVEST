'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';
import { accountKeys, type UserSettings } from './queries';

/**
 * Switches the interface language and remembers it in the account, so every
 * device and every email (the templates read `user_metadata.locale`) follows.
 */
export function useSetLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const [pending, setPending] = useState(false);

  async function setLocale(locale: AppLocale) {
    const key = accountKeys.settings(userId);
    const previous = queryClient.getQueryData<UserSettings>(key);
    if (!userId || previous?.locale === locale) {
      router.replace(pathname, { locale });
      return;
    }
    setPending(true);
    // Update the cache first: the app guard must already see the new language
    // when the page re-renders under the new locale.
    queryClient.setQueryData<UserSettings>(key, (s) => (s ? { ...s, locale } : s));
    const supabase = getSupabase();
    const [settingsResult] = await Promise.all([
      supabase.from('user_settings').update({ locale }).eq('user_id', userId),
      supabase.auth.updateUser({ data: { locale } }),
    ]);
    setPending(false);
    if (settingsResult.error) {
      queryClient.setQueryData(key, previous);
      throw settingsResult.error;
    }
    router.replace(pathname, { locale });
  }

  return { setLocale, pending };
}
