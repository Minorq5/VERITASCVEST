// Deletes the caller's account for good.
//
// 1. Identifies the caller by their own access token (asks Auth who it is).
// 2. Requires the username typed into the confirmation box.
// 3. Removes their files from Storage (Storage rows cannot be deleted by SQL):
//    the avatar folder, and every attachment on their tasks or uploaded by them.
// 4. Deletes the Auth user; every table references auth.users with
//    ON DELETE CASCADE, so profiles, settings and (later) tasks go with it.
//
// Plain fetch, no imports: nothing to download at cold start.
// verify_jwt is off in config.toml because the check happens here.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const BUCKETS = ['avatars'];

function keyFrom(jsonName: string, legacyName: string): string {
  const json = Deno.env.get(jsonName);
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // fall through to the legacy variable
    }
  }
  return Deno.env.get(legacyName) ?? '';
}

const SECRET_KEY = keyFrom('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const PUBLISHABLE_KEY = keyFrom('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

/** New secret keys go in `apikey` only; legacy service-role JWTs also need Authorization. */
function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { apikey: SECRET_KEY, ...extra };
  if (!SECRET_KEY.startsWith('sb_secret_')) headers.Authorization = `Bearer ${SECRET_KEY}`;
  return headers;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function currentUser(authorization: string): Promise<{ id: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: authorization },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ? { id: user.id } : null;
}

async function usernameOf(userId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=username`,
    { headers: adminHeaders({ Accept: 'application/json' }) },
  );
  if (!res.ok) throw new Error(`profile lookup failed: ${res.status}`);
  const rows = (await res.json()) as { username: string }[];
  return rows[0]?.username ?? null;
}

async function rows<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${offset}`, {
      headers: adminHeaders({ Accept: 'application/json' }),
    });
    if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/** Files attached to the person's tasks (whoever uploaded them) and files they attached anywhere. */
async function attachmentPaths(userId: string): Promise<string[]> {
  const id = encodeURIComponent(userId);
  type Row = { storage_path: string | null; thumb_path: string | null };
  const found = [
    ...(await rows<Row>(`attachments?select=storage_path,thumb_path,tasks!inner(owner_id)&tasks.owner_id=eq.${id}`)),
    ...(await rows<Row>(`attachments?select=storage_path,thumb_path&uploader_id=eq.${id}`)),
  ];
  const paths = new Set<string>();
  for (const row of found) {
    if (row.storage_path) paths.add(row.storage_path);
    if (row.thumb_path) paths.add(row.thumb_path);
  }
  return [...paths];
}

async function removePaths(bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 1000) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: paths.slice(i, i + 1000) }),
    });
    if (!res.ok) throw new Error(`storage delete failed: ${res.status}`);
  }
}

async function removeFolder(bucket: string, userId: string): Promise<void> {
  for (;;) {
    const list = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset: 0 }),
    });
    if (!list.ok) throw new Error(`storage list failed: ${list.status}`);
    const files = (await list.json()) as { name: string }[];
    if (files.length === 0) return;
    const remove = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: files.map((f) => `${userId}/${f.name}`) }),
    });
    if (!remove.ok) throw new Error(`storage delete failed: ${remove.status}`);
    if (files.length < 1000) return;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SECRET_KEY || !PUBLISHABLE_KEY) return reply(500, { error: 'not_configured' });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' });

  try {
    const user = await currentUser(authorization);
    if (!user) return reply(401, { error: 'unauthorized' });

    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
    const username = await usernameOf(user.id);
    if (typeof body.confirm !== 'string' || !username || body.confirm.trim().toLowerCase() !== username.toLowerCase()) {
      return reply(400, { error: 'confirmation_mismatch' });
    }

    for (const bucket of BUCKETS) await removeFolder(bucket, user.id);
    await removePaths('attachments', await attachmentPaths(user.id));

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`auth delete failed: ${res.status}`);

    return reply(200, { ok: true });
  } catch (error) {
    console.error('delete-account', error instanceof Error ? error.message : error);
    return reply(500, { error: 'internal' });
  }
});
