'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';

/** Keeps the session store in step with Supabase Auth across tabs. */
export function SessionSync() {
  const setSession = useSession((s) => s.setSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      return;
    }
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [setSession, queryClient]);

  return null;
}
