import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { VeritasDB } from '@/lib/db/schema';
import type { Entity } from '@/lib/db/types';
import {
  SyncEngine,
  TransportError,
  type ConflictNotice,
  type PullResponse,
  type PushResult,
  type RejectedNotice,
  type SyncTransport,
  type WireMutation,
} from '@/lib/sync/engine';
import { Repo } from '@/lib/sync/repo';
import { supabaseTransport } from '@/lib/sync/supabase-transport';

function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing in .env.local`);
  return line.slice(name.length + 1).trim();
}

export const URL = env('NEXT_PUBLIC_SUPABASE_URL');
const PUBLISHABLE = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const SECRET = env('SUPABASE_SECRET_KEY');

let seq = 0;

export async function createUser() {
  seq += 1;
  const tag = `${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 5)}`;
  const email = `int-${tag}@example.com`;
  const password = 'Orbita2026x';
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: `int_${tag}`.slice(0, 24), locale: 'ru', timezone: 'Europe/Moscow' },
    }),
  });
  if (!res.ok) throw new Error(`createUser ${res.status}: ${await res.text()}`);
  const user = (await res.json()) as { id: string };
  return { id: user.id, email, password };
}

/** A signed-in client: each call is a separate session (a separate device). */
export async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/** Reads bypassing RLS (verification only). */
export async function adminRows(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers: { apikey: SECRET } });
  if (!res.ok) throw new Error(`adminRows ${res.status}: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>[];
}

export type Fault = 'drop-request' | 'drop-response' | 'duplicate';

/** The real transport with a flaky network in front of it. */
export class FaultyTransport implements SyncTransport {
  offline = false;
  readonly faults: Fault[] = [];
  constructor(readonly inner: SyncTransport) {}
  private gate() {
    if (this.offline) throw new TransportError('network', 'offline');
  }
  async push(mutations: WireMutation[]): Promise<PushResult[]> {
    this.gate();
    const fault = this.faults.shift();
    if (fault === 'drop-request') throw new TransportError('network', 'request lost');
    const result = await this.inner.push(mutations);
    if (fault === 'drop-response') throw new TransportError('network', 'answer lost');
    if (fault === 'duplicate') return this.inner.push(mutations);
    return result;
  }
  async pull(cursor: string | null): Promise<PullResponse> {
    this.gate();
    return this.inner.pull(cursor);
  }
  async cursor() {
    this.gate();
    return this.inner.cursor();
  }
  async bootstrap(entity: Entity, after: string | null, limit: number) {
    this.gate();
    return this.inner.bootstrap(entity, after, limit);
  }
}

let dbSeq = 0;
let clockMs = Date.now();

export function device(client: SupabaseClient, options: { bootstrapPage?: number } = {}) {
  dbSeq += 1;
  const db = new VeritasDB(`int-${Date.now()}-${dbSeq}`);
  const transport = new FaultyTransport(supabaseTransport(client, `test-${dbSeq}`));
  const conflicts: ConflictNotice[] = [];
  const rejected: RejectedNotice[] = [];
  const engine = new SyncEngine({
    db,
    transport,
    manual: true,
    isOnline: () => !transport.offline,
    bootstrapPage: options.bootstrapPage,
    onConflict: (c) => conflicts.push(c),
    onRejected: (r) => rejected.push(r),
  });
  // A strictly increasing clock shared by all devices: "later" is well defined in tests.
  const repo = new Repo({ db, now: () => (clockMs += 5) });
  return { client, db, transport, engine, repo, conflicts, rejected };
}

export async function settle(...devices: ReturnType<typeof device>[]) {
  for (let round = 0; round < 2; round += 1) for (const d of devices) await d.engine.syncNow();
}

export async function newTask(d: ReturnType<typeof device>, ownerId: string, title: string, extra: Record<string, unknown> = {}) {
  const { row } = await d.repo.insert('tasks', {
    owner_id: ownerId,
    title,
    type: 'normal',
    timezone: 'Europe/Moscow',
    sort_key: 'a0',
    ...extra,
  } as never);
  return row!;
}
