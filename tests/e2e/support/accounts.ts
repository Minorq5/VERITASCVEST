import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** Local-only keys from .env.local (the default keys of the local Supabase). */
function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const file = readFileSync('.env.local', 'utf8');
  const line = file.split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is missing in .env.local`);
  return line.slice(name.length + 1).trim();
}

export const API = () => env('NEXT_PUBLIC_SUPABASE_URL');
export const PUBLISHABLE_KEY = () => env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export function uniqueAccount(prefix = 'e2e') {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    email: `${prefix}-${id}@example.com`,
    username: `${prefix}_${id}`.slice(0, 24),
    password: 'Orbita2026x',
  };
}

/** A confirmed account created straight through the Auth admin API (skips the email step). */
export async function createAccount(options: { locale?: string; onboarded?: boolean } = {}) {
  const account = uniqueAccount();
  const res = await fetch(`${API()}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_SECRET_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        username: account.username,
        display_name: account.username,
        locale: options.locale ?? 'ru',
        timezone: 'Europe/Moscow',
      },
    }),
  });
  if (!res.ok) throw new Error(`createAccount: ${res.status} ${await res.text()}`);
  const user = (await res.json()) as { id: string };
  if (options.onboarded !== false) {
    await fetch(`${API()}/rest/v1/user_settings?user_id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { apikey: env('SUPABASE_SECRET_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }),
    });
  }
  return { ...account, id: user.id };
}

export async function userExists(email: string): Promise<boolean> {
  const res = await fetch(`${API()}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: env('SUPABASE_SECRET_KEY') },
  });
  const body = (await res.json()) as { users: { email: string }[] };
  return body.users.some((u) => u.email === email);
}

export async function signIn(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/ru/login?next=${encodeURIComponent(next)}` : '/ru/login');
  await page.getByLabel('Почта').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

/** Rows left behind for a user id (checked with the secret key, bypassing RLS). */
export async function leftovers(userId: string) {
  const headers = { apikey: env('SUPABASE_SECRET_KEY') };
  const [profiles, settings] = await Promise.all([
    fetch(`${API()}/rest/v1/profiles?id=eq.${userId}&select=id`, { headers }).then((r) => r.json()),
    fetch(`${API()}/rest/v1/user_settings?user_id=eq.${userId}&select=user_id`, { headers }).then((r) => r.json()),
  ]);
  return { profiles: (profiles as unknown[]).length, settings: (settings as unknown[]).length };
}

/**
 * Makes the user's sessions look two days old, so Supabase asks for
 * reauthentication before a password change (local stack only: uses Docker).
 */
export function ageSessions(userId: string, container = 'supabase_db_veritas-tasks') {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error('bad user id');
  execFileSync('docker', [
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-c',
    `update auth.sessions set created_at = now() - interval '2 days' where user_id = '${userId}'`,
  ]);
}
