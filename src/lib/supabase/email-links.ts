'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let mailer: SupabaseClient<Database> | null = null;

/**
 * For requests that email a link: sign-up, a new confirmation letter, a
 * password reset. Without PKCE the link carries its own proof, so it works on
 * any device — people sign up on a computer and open the letter on a phone.
 * (With PKCE only the browser that asked could finish.) Holds no session.
 */
export function emailLinkClient(): SupabaseClient<Database> {
  if (!mailer) {
    mailer = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return mailer;
}
