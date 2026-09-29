import Dexie from 'dexie';
import { newId } from '@/lib/ids';
import type { VeritasDB } from '@/lib/db/schema';
import { taskParts, type AnyRow, type Entity, type Mutation, type Op } from '@/lib/db/types';

/**
 * Local side of synchronisation. Visible row = server row ("shadow") with the
 * device's unsent mutations re-applied in order. Every function here runs in
 * one IndexedDB transaction, so a closed tab can never leave half a change.
 */

export type RowKey = [Entity, string];

export const SYNC_TABLES = (db: VeritasDB) => [db.shadows, db.outbox, db.tombstones, db.meta, ...entityTables(db)];

function entityTables(db: VeritasDB) {
  return [
    db.statuses,
    db.priorities,
    db.projects,
    db.tags,
    db.templates,
    db.tasks,
    db.task_tags,
    db.task_milestones,
    db.progress_events,
    db.habit_logs,
    db.time_sessions,
    db.task_completions,
    db.attachments,
    db.comments,
  ];
}

// ---------------------------------------------------------------------------
// Ordering of server rows
// ---------------------------------------------------------------------------
function tx(value: unknown): bigint | null {
  if (value == null || value === '') return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

/** Compares transaction ids (as text): <0, 0, >0; unknown counts as oldest. */
export function compareTx(a: unknown, b: unknown): number {
  const x = tx(a);
  const y = tx(b);
  if (x === y) return 0;
  if (x === null) return -1;
  if (y === null) return 1;
  return x < y ? -1 : 1;
}

/** Is `incoming` at least as new as `current` (later transaction, or same one with a higher version)? */
export function isNewerOrSame(incoming: AnyRow, current: AnyRow): boolean {
  const c = compareTx(incoming.tx_id, current.tx_id);
  if (c !== 0) return c > 0;
  return Number(incoming.version ?? 0) >= Number(current.version ?? 0);
}

/** Server JSON → local row: no merge clock, transaction id as text. */
export function normalizeRow(raw: Record<string, unknown>): AnyRow {
  const { field_ts: _clock, ...rest } = raw;
  return { ...rest, tx_id: rest.tx_id == null ? null : String(rest.tx_id) } as AnyRow;
}

// ---------------------------------------------------------------------------
// Mutations applied locally
// ---------------------------------------------------------------------------
export function applyMutation(row: AnyRow | null, m: Mutation): AnyRow | null {
  switch (m.op) {
    case 'insert': {
      if (row) return { ...row, ...m.data, id: m.row_id };
      // Until the server's row arrives, the edit time stands in for its timestamps.
      const stamp = new Date(m.ts).toISOString();
      return { version: 0, tx_id: null, created_at: stamp, updated_at: stamp, ...m.data, id: m.row_id } as AnyRow;
    }
    case 'update':
      return row ? ({ ...row, ...m.data } as AnyRow) : null;
    case 'delete':
      return null;
  }
}

/** Recomputes the visible rows for these keys. */
export async function rebase(db: VeritasDB, keys: Iterable<RowKey>): Promise<void> {
  const unique = new Map<string, RowKey>();
  for (const k of keys) unique.set(`${k[0]}\u0000${k[1]}`, k);
  for (const [entity, id] of unique.values()) {
    const shadow = await db.shadows.get([entity, id]);
    const pending = await db.outbox.where('[entity+row_id]').equals([entity, id]).sortBy('seq');
    let row: AnyRow | null = shadow ? { ...shadow.row } : null;
    for (const m of pending) row = applyMutation(row, m);
    if (row) await db.table_(entity).put(row);
    else await db.table_(entity).delete(id);
  }
}

export interface EnqueueInput {
  entity: Entity;
  op: Op;
  row_id: string;
  data: Record<string, unknown>;
  base?: Record<string, unknown>;
}

/**
 * Adds a change to the outbox and shows it at once. Consecutive edits of the
 * same row merge while the previous edit has not been picked up by a push
 * yet (it is not "sealed"); a sealed mutation is never altered, because the
 * server may already have applied it.
 */
export async function enqueue(db: VeritasDB, input: EnqueueInput, ts: number = Date.now()): Promise<Mutation> {
  return db.transaction('rw', [db.outbox, db.shadows, db.table_(input.entity)], async () => {
    const last = await db.outbox.where('[entity+row_id]').equals([input.entity, input.row_id]).last();
    let mutation: Mutation;
    if (last && last.sealed === 0 && input.op === 'update' && (last.op === 'update' || last.op === 'insert')) {
      mutation = {
        ...last,
        data: { ...last.data, ...input.data },
        base: last.op === 'insert' ? undefined : { ...(input.base ?? {}), ...(last.base ?? {}) },
        ts,
      };
      await db.outbox.put(mutation);
    } else {
      mutation = { id: newId(), entity: input.entity, op: input.op, row_id: input.row_id, data: input.data, base: input.base, ts, sealed: 0 };
      mutation.seq = await db.outbox.add(mutation);
    }
    await rebase(db, [[input.entity, input.row_id]]);
    return mutation;
  });
}

// ---------------------------------------------------------------------------
// Server data arriving (push answers, pulls, realtime)
// ---------------------------------------------------------------------------
export async function acceptRows(db: VeritasDB, entity: Entity, rows: readonly Record<string, unknown>[]): Promise<RowKey[]> {
  const keys: RowKey[] = [];
  for (const raw of rows) {
    const row = normalizeRow(raw);
    const key: RowKey = [entity, row.id];
    const tomb = await db.tombstones.get(key);
    if (tomb) {
      // The row was deleted in a later (or the same) transaction: ignore the stale copy.
      if (compareTx(tomb.tx, row.tx_id) >= 0) continue;
      await db.tombstones.delete(key);
    }
    const shadow = await db.shadows.get(key);
    if (!shadow || isNewerOrSame(row, shadow.row)) {
      await db.shadows.put({ entity, id: row.id, row });
      keys.push(key);
    }
  }
  return keys;
}

export interface Tombstone {
  entity: Entity;
  id: string;
  tx_id: string;
}

export async function acceptTombstones(db: VeritasDB, tombstones: readonly Tombstone[], now = Date.now()): Promise<RowKey[]> {
  const keys: RowKey[] = [];
  for (const t of tombstones) {
    const key: RowKey = [t.entity, t.id];
    const shadow = await db.shadows.get(key);
    // Created again after this deletion (same content id): keep the newer row.
    if (shadow && compareTx(shadow.row.tx_id, t.tx_id) > 0) continue;
    await db.shadows.delete(key);
    await db.tombstones.put({ entity: t.entity, id: t.id, tx: String(t.tx_id), at: now });
    keys.push(key);
    if (t.entity === 'tasks') keys.push(...(await dropTaskParts(db, t.id)));
  }
  return keys;
}

/** A purged task takes its parts along (the server cascades the same way). */
async function dropTaskParts(db: VeritasDB, taskId: string): Promise<RowKey[]> {
  const keys: RowKey[] = [];
  for (const part of taskParts) {
    const ids = (await db.table_(part).where('task_id').equals(taskId).primaryKeys()) as string[];
    for (const id of ids) {
      await db.shadows.delete([part, id]);
      keys.push([part, id]);
    }
  }
  return keys;
}

/** Realtime says a row is gone (no transaction id): forget it; the next pull confirms. */
export async function dropRow(db: VeritasDB, entity: Entity, id: string): Promise<RowKey[]> {
  await db.shadows.delete([entity, id]);
  const keys: RowKey[] = [[entity, id]];
  if (entity === 'tasks') keys.push(...(await dropTaskParts(db, id)));
  return keys;
}

/**
 * After a full download: forget rows the server no longer has, unless they
 * changed after the download started (then the next pull decides).
 */
export async function forgetMissing(db: VeritasDB, entity: Entity, seen: ReadonlySet<string>, since: string): Promise<RowKey[]> {
  const keys: RowKey[] = [];
  const all = await db.shadows.where('[entity+id]').between([entity, Dexie.minKey], [entity, Dexie.maxKey]).toArray();
  for (const s of all) {
    if (seen.has(s.id) || compareTx(s.row.tx_id, since) >= 0) continue;
    await db.shadows.delete([entity, s.id]);
    keys.push([entity, s.id]);
  }
  return keys;
}

/** Old tombstones are only needed to reject late realtime echoes. */
export async function pruneTombstones(db: VeritasDB, olderThanMs: number, now = Date.now()): Promise<void> {
  await db.tombstones.filter((t) => now - t.at > olderThanMs).delete();
}

export async function pendingCount(db: VeritasDB): Promise<number> {
  return db.outbox.count();
}
