'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type VeritasClient = SupabaseClient<Database>;

let client: VeritasClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * One browser client per tab. The session lives in cookies (via @supabase/ssr)
 * so the proxy can redirect signed-out visitors before a page even renders.
 */
export function getSupabase(): VeritasClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
  }
  client = createBrowserClient<Database>(url, key, {
    cookieOptions: {
      sameSite: 'lax',
      secure: typeof location !== 'undefined' && location.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
    },
  });
  return client;
}

/** Public URL of a file in the avatars bucket. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/avatars/${path}` : null;
}
