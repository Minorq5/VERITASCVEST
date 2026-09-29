import { taskParts, type Entity } from '@/lib/db/types';
import {
  TransportError,
  type PullResponse,
  type PushResult,
  type SyncTransport,
  type WireMutation,
} from '@/lib/sync/engine';

/**
 * In-memory stand-in for sync_push / sync_pull with the same rules as the SQL
 * (supabase/migrations/…_tasks.sql): idempotent mutation ids, per-field
 * 3-way merge, last-edit-wins on real conflicts, tombstones, snapshot cursor.
 * Integration tests run the same scenarios against the real database.
 */
type Clock = [number, string];
interface Stored {
  row: Record<string, unknown>;
  clocks: Record<string, Clock>;
}

const SERVER_OWNED = new Set(['id', 'owner_id', 'user_id', 'task_id', 'created_at', 'updated_at', 'version', 'tx_id']);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const newer = (mine: Clock, clock: Clock | undefined) =>
  !clock || mine[0] > clock[0] || (mine[0] === clock[0] && mine[1] > clock[1]);
const copy = <T>(value: T): T => structuredClone(value);

export class FakeServer {
  xid = 100n;
  readonly tables = new Map<Entity, Map<string, Stored>>();
  readonly decisions = new Map<string, { status: 'applied' | 'rejected'; error?: string }>();
  readonly tombstones: { entity: Entity; id: string; tx: bigint }[] = [];
  readonly conflictLog: { entity: Entity; id: string; field: string; kept: unknown; lost: unknown }[] = [];
  pushCalls = 0;
  applyCount = 0;

  table(entity: Entity) {
    let t = this.tables.get(entity);
    if (!t) {
      t = new Map();
      this.tables.set(entity, t);
    }
    return t;
  }

  rows(entity: Entity): Record<string, unknown>[] {
    return [...this.table(entity).values()].map((s) => copy(s.row));
  }

  push(mutations: WireMutation[]): PushResult[] {
    this.pushCalls += 1;
    const tx = ++this.xid;
    return mutations.map((m) => this.apply(m, tx));
  }

  private visible(entity: Entity, id: string) {
    const s = this.table(entity).get(id);
    return s ? copy(s.row) : null;
  }

  private apply(m: WireMutation, tx: bigint): PushResult {
    const prev = this.decisions.get(m.id);
    if (prev) {
      return { id: m.id, status: 'duplicate', decision: prev.status, error: prev.error ?? null, row: this.visible(m.entity, m.row_id) };
    }
    try {
      let out: { row: Record<string, unknown> | null; conflicts: PushResult['conflicts'] };
      if (m.op === 'insert') out = this.insert(m, tx);
      else if (m.op === 'update') out = this.update(m.entity, m.row_id, m.data, m.base ?? {}, m.ts, m.id, tx);
      else out = this.remove(m.entity, m.row_id, tx);
      this.decisions.set(m.id, { status: 'applied' });
      this.applyCount += 1;
      return { id: m.id, status: 'applied', row: out.row, conflicts: out.conflicts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.decisions.set(m.id, { status: 'rejected', error: message });
      return { id: m.id, status: 'rejected', error: message, row: this.visible(m.entity, m.row_id) };
    }
  }

  private insert(m: WireMutation, tx: bigint) {
    const t = this.table(m.entity);
    if (t.has(m.row_id)) return this.update(m.entity, m.row_id, m.data, null, m.ts, m.id, tx);
    if (m.entity !== 'tasks' && 'task_id' in m.data && !this.table('tasks').has(String(m.data.task_id))) {
      throw new Error('23503:task_not_found');
    }
    const clocks: Record<string, Clock> = {};
    for (const k of Object.keys(m.data)) if (k !== 'id') clocks[k] = [m.ts, m.id];
    const row = { ...copy(m.data), id: m.row_id, version: 1, tx_id: String(tx) };
    t.set(m.row_id, { row, clocks });
    return { row: copy(row), conflicts: [] };
  }

  private update(entity: Entity, id: string, data: Record<string, unknown>, base: Record<string, unknown> | null, ts: number, mid: string, tx: bigint) {
    const s = this.table(entity).get(id);
    if (!s) throw new Error('P0002:not_found');
    const changes: Record<string, unknown> = {};
    const conflicts: NonNullable<PushResult['conflicts']> = [];
    for (const [f, mine] of Object.entries(data)) {
      if (SERVER_OWNED.has(f)) {
        if (base === null) continue;
        throw new Error(`42501:field_not_writable:${f}`);
      }
      const cur = s.row[f];
      if (same(cur, mine)) continue;
      if (base !== null && f in base && same(base[f], cur)) {
        changes[f] = mine;
        s.clocks[f] = [ts, mid];
      } else if (newer([ts, mid], s.clocks[f])) {
        changes[f] = mine;
        s.clocks[f] = [ts, mid];
        conflicts.push({ field: f, kept: mine, lost: cur, winner: 'mine' });
        this.conflictLog.push({ entity, id, field: f, kept: mine, lost: cur });
      } else {
        conflicts.push({ field: f, kept: cur, lost: mine, winner: 'server' });
        this.conflictLog.push({ entity, id, field: f, kept: cur, lost: mine });
      }
    }
    if (Object.keys(changes).length) {
      s.row = { ...s.row, ...copy(changes), version: Number(s.row.version) + 1, tx_id: String(tx) };
    }
    return { row: copy(s.row), conflicts };
  }

  private remove(entity: Entity, id: string, tx: bigint) {
    const t = this.table(entity);
    if (!t.has(id)) return { row: null, conflicts: [] };
    t.delete(id);
    this.tombstones.push({ entity, id, tx });
    if (entity === 'tasks') {
      for (const [childId, s] of [...this.table('tasks').entries()]) {
        if (s.row.parent_id === id) this.remove('tasks', childId, tx);
      }
      for (const part of taskParts) {
        for (const [partId, s] of [...this.table(part).entries()]) {
          if (s.row.task_id === id) {
            this.table(part).delete(partId);
            this.tombstones.push({ entity: part, id: partId, tx });
          }
        }
      }
    }
    return { row: null, conflicts: [] };
  }

  cursor(): string {
    return String(this.xid + 1n);
  }

  pull(cursor: string | null): PullResponse {
    const from = BigInt(cursor ?? '0');
    const changes: Record<string, Record<string, unknown>[]> = {};
    for (const [entity, t] of this.tables) {
      changes[entity] = [...t.values()].filter((s) => BigInt(String(s.row.tx_id)) >= from).map((s) => copy(s.row));
    }
    return {
      cursor: this.cursor(),
      changes,
      tombstones: this.tombstones.filter((t) => t.tx >= from).map((t) => ({ entity: t.entity, id: t.id, tx_id: String(t.tx) })),
      truncated: false,
    };
  }

  bootstrap(entity: Entity, after: string | null, limit: number): Record<string, unknown>[] {
    return [...this.table(entity).values()]
      .map((s) => s.row)
      .filter((r) => after === null || String(r.id) > after)
      .sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))
      .slice(0, limit)
      .map((r) => copy(r));
  }
}

export type Fault = 'drop-request' | 'drop-response' | 'duplicate';

/** A transport with a flaky network: requests or answers can be lost, or delivered twice. */
export class FlakyTransport implements SyncTransport {
  offline = false;
  readonly faults: Fault[] = [];

  constructor(private readonly server: FakeServer) {}

  private gate() {
    if (this.offline) throw new TransportError('network', 'offline');
  }

  async push(mutations: WireMutation[]): Promise<PushResult[]> {
    this.gate();
    const fault = this.faults.shift();
    if (fault === 'drop-request') throw new TransportError('network', 'request lost');
    const result = this.server.push(copy(mutations));
    if (fault === 'drop-response') throw new TransportError('network', 'answer lost');
    if (fault === 'duplicate') return copy(this.server.push(copy(mutations)));
    return copy(result);
  }

  async pull(cursor: string | null): Promise<PullResponse> {
    this.gate();
    const fault = this.faults.shift();
    if (fault === 'drop-request' || fault === 'drop-response') throw new TransportError('network', 'pull lost');
    return copy(this.server.pull(cursor));
  }

  async cursor(): Promise<string> {
    this.gate();
    return this.server.cursor();
  }

  async bootstrap(entity: Entity, after: string | null, limit: number) {
    this.gate();
    return copy(this.server.bootstrap(entity, after, limit));
  }
}
