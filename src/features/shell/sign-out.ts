'use client';

import { getSupabase } from '@/lib/supabase/client';

/** Signs out on this device (`local`) or on every device (`global`). */
export async function signOut(scope: 'local' | 'global' = 'local') {
  const { error } = await getSupabase().auth.signOut({ scope });
  if (error) throw error;
}
