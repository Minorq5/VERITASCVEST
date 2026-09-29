import type { VeritasDB } from '@/lib/db/schema';
import type { AnyRow, Entity, LocalRow } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { enqueue } from './local';

/**
 * Writing data: every call changes the device copy at once (the interface
 * never waits) and queues the change for the server. Each call returns the
 * inverse change, which is how "Undo" works for any action.
 */

export interface Change {
  entity: Entity;
  op: 'insert' | 'update' | 'delete';
  id: string;
  data: Record<string, unknown>;
}

export interface WriteResult<T = AnyRow> {
  row: T | null;
  /** Applying these restores the previous state. */
  inverse: Change[];
}

export interface RepoOptions {
  db: VeritasDB;
  /** Called after every write (the sync engine pushes soon). */
  onWrite?: () => void;
  now?: () => number;
}

/** Values of `keys` in `row`, for the 3-way merge base. */
function pick(row: AnyRow, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export class Repo {
  constructor(private readonly options: RepoOptions) {}

  get db() {
    return this.options.db;
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }

  async get<E extends Entity>(entity: E, id: string): Promise<LocalRow<E> | undefined> {
    return (await this.db.table_(entity).get(id)) as LocalRow<E> | undefined;
  }

  /** Creates a row (the id is made here unless given). */
  async insert<E extends Entity>(entity: E, data: Partial<LocalRow<E>> & Record<string, unknown>): Promise<WriteResult<LocalRow<E>>> {
    const id = (data.id as string | undefined) ?? newId();
    const payload: Record<string, unknown> = { ...data, id };
    delete payload.version;
    delete payload.tx_id;
    delete payload.created_at;
    delete payload.updated_at;
    await enqueue(this.db, { entity, op: 'insert', row_id: id, data: payload }, this.now());
    this.options.onWrite?.();
    return {
      row: ((await this.db.table_(entity).get(id)) as LocalRow<E> | undefined) ?? null,
      inverse: [{ entity, op: 'delete', id, data: {} }],
    };
  }

  /** Changes fields; unchanged values are dropped so the merge sees only real edits. */
  async update<E extends Entity>(entity: E, id: string, patch: Partial<LocalRow<E>> & Record<string, unknown>): Promise<WriteResult<LocalRow<E>>> {
    const current = await this.db.table_(entity).get(id);
    if (!current) return { row: null, inverse: [] };
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'id' || k === 'version' || k === 'tx_id' || k === 'created_at' || k === 'updated_at') continue;
      if (!sameValue(current[k], v)) data[k] = v === undefined ? null : v;
    }
    const keys = Object.keys(data);
    if (keys.length === 0) return { row: current as LocalRow<E>, inverse: [] };
    const base = pick(current, keys);
    await enqueue(this.db, { entity, op: 'update', row_id: id, data, base }, this.now());
    this.options.onWrite?.();
    return {
      row: ((await this.db.table_(entity).get(id)) as LocalRow<E> | undefined) ?? null,
      inverse: [{ entity, op: 'update', id, data: base }],
    };
  }

  /** Permanent delete (emptying the trash). */
  async remove(entity: Entity, id: string): Promise<WriteResult> {
    const current = await this.db.table_(entity).get(id);
    if (!current) return { row: null, inverse: [] };
    await enqueue(this.db, { entity, op: 'delete', row_id: id, data: {} }, this.now());
    this.options.onWrite?.();
    const { version: _v, tx_id: _t, created_at: _c, updated_at: _u, ...restorable } = current;
    return { row: null, inverse: [{ entity, op: 'insert', id, data: restorable }] };
  }

  /** Applies a list of changes (used by Undo/Redo); returns their inverses in reverse order. */
  async apply(changes: readonly Change[]): Promise<Change[]> {
    const inverses: Change[] = [];
    for (const c of changes) {
      let result: WriteResult;
      if (c.op === 'insert') result = await this.insert(c.entity, { ...c.data, id: c.id } as never);
      else if (c.op === 'update') result = await this.update(c.entity, c.id, c.data as never);
      else result = await this.remove(c.entity, c.id);
      inverses.unshift(...result.inverse);
    }
    return inverses;
  }
}
