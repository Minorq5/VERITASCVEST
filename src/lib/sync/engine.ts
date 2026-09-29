import type { VeritasDB } from '@/lib/db/schema';
import { entities, isEntity, type Entity, type Mutation } from '@/lib/db/types';
import {
  SYNC_TABLES,
  acceptRows,
  acceptTombstones,
  dropRow,
  forgetMissing,
  pruneTombstones,
  rebase,
  type RowKey,
  type Tombstone,
} from './local';

// ---------------------------------------------------------------------------
// Transport contract (implemented with Supabase in ./supabase-transport.ts)
// ---------------------------------------------------------------------------
export interface WireMutation {
  id: string;
  entity: Entity;
  op: Mutation['op'];
  row_id: string;
  data: Record<string, unknown>;
  base?: Record<string, unknown>;
  ts: number;
}

export interface PushConflict {
  field: string;
  kept: unknown;
  lost: unknown;
  winner: 'mine' | 'server';
}

export interface PushResult {
  id: string;
  status: 'applied' | 'duplicate' | 'rejected';
  decision?: 'applied' | 'rejected';
  error?: string | null;
  row?: Record<string, unknown> | null;
  conflicts?: PushConflict[];
}

export interface PullResponse {
  cursor: string | null;
  changes?: Partial<Record<string, Record<string, unknown>[]>>;
  tombstones?: Tombstone[];
  truncated?: boolean;
  reset?: boolean;
}

export interface RealtimeHandlers {
  onRow(entity: Entity, row: Record<string, unknown>): void;
  onDelete(entity: Entity, id: string): void;
  onReconnect(): void;
}

export interface SyncTransport {
  push(mutations: WireMutation[]): Promise<PushResult[]>;
  pull(cursor: string | null): Promise<PullResponse>;
  cursor(): Promise<string>;
  bootstrap(entity: Entity, after: string | null, limit: number): Promise<Record<string, unknown>[]>;
  subscribe?(handlers: RealtimeHandlers): () => void;
}

export type TransportFailure = 'network' | 'auth' | 'rate' | 'server';

export class TransportError extends Error {
  constructor(
    readonly kind: TransportFailure,
    message: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'auth' | 'standby';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncAt: number | null;
  retryAt: number | null;
  /** This tab runs the synchronisation (other tabs of the same account wait). */
  leader: boolean;
  bootstrapped: boolean;
}

export interface ConflictNotice {
  entity: Entity;
  rowId: string;
  fields: PushConflict[];
}

export interface RejectedNotice {
  entity: Entity;
  rowId: string;
  op: Mutation['op'];
  error: string;
}

export interface SyncEngineOptions {
  db: VeritasDB;
  transport: SyncTransport;
  /** Lock name for leader election between tabs (Web Locks). */
  lockName?: string;
  isOnline?: () => boolean;
  now?: () => number;
  pullIntervalMs?: number;
  pushDelayMs?: number;
  batchSize?: number;
  bootstrapPage?: number;
  /** Tests run without timers or locks. */
  manual?: boolean;
  onStatus?: (status: SyncStatus) => void;
  onConflict?: (notice: ConflictNotice) => void;
  onRejected?: (notice: RejectedNotice) => void;
}

const MAX_BACKOFF = 60_000;

export class SyncEngine {
  private readonly db: VeritasDB;
  private readonly transport: SyncTransport;
  private readonly opts: SyncEngineOptions;
  private chain: Promise<unknown> = Promise.resolve();
  private stopped = true;
  private leader = false;
  /** Each start() is a new generation; a lock granted to an older one is released at once. */
  private generation = 0;
  private failures = 0;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private releaseLock: (() => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private cleanups: (() => void)[] = [];
  private status: SyncStatus = { state: 'standby', pending: 0, lastSyncAt: null, retryAt: null, leader: false, bootstrapped: false };

  constructor(opts: SyncEngineOptions) {
    this.opts = opts;
    this.db = opts.db;
    this.transport = opts.transport;
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  private online() {
    // Unknown (no navigator.onLine) counts as online: failed requests say otherwise.
    return this.opts.isOnline?.() ?? (typeof navigator === 'undefined' || navigator.onLine !== false);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.opts.onStatus?.(this.status);
  }

  async refreshPending() {
    this.setStatus({ pending: await this.db.outbox.count() });
  }

  /** Serialises every network round: pushes and pulls never interleave. */
  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task);
    this.chain = next.catch(() => undefined);
    return next;
  }

  // -------------------------------------------------------------- lifecycle --
  async start(): Promise<void> {
    if (!this.stopped) return;
    this.stopped = false;
    const generation = (this.generation += 1);
    this.status = { ...this.status, bootstrapped: Boolean(await this.db.meta.get('cursor')) };
    await this.refreshPending();
    if (this.opts.manual) {
      this.becomeLeader();
      return;
    }
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks && this.opts.lockName) {
      void locks.request(this.opts.lockName, { mode: 'exclusive' }, () => {
        if (this.stopped || generation !== this.generation) return undefined;
        this.becomeLeader();
        return new Promise<void>((resolve) => {
          this.releaseLock = resolve;
        });
      });
      this.setStatus({ state: 'standby' });
    } else {
      this.becomeLeader();
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.leader = false;
    for (const t of [this.pushTimer, this.retryTimer]) if (t) clearTimeout(t);
    if (this.pullTimer) clearInterval(this.pullTimer);
    this.pushTimer = this.retryTimer = this.pullTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.releaseLock?.();
    this.releaseLock = null;
    await this.chain.catch(() => undefined);
  }

  private becomeLeader() {
    this.leader = true;
    this.setStatus({ leader: true, state: this.online() ? 'idle' : 'offline' });
    if (this.opts.manual) return;
    this.unsubscribe =
      this.transport.subscribe?.({
        onRow: (entity, row) => void this.applyRealtimeRow(entity, row),
        onDelete: (entity, id) => void this.applyRealtimeDelete(entity, id),
        onReconnect: () => this.schedulePull(),
      }) ?? null;
    this.pullTimer = setInterval(() => this.schedulePull(), this.opts.pullIntervalMs ?? 60_000);
    if (typeof window !== 'undefined') {
      const online = () => {
        this.setStatus({ state: 'idle' });
        this.failures = 0;
        void this.syncNow();
      };
      const offline = () => this.setStatus({ state: 'offline' });
      const visible = () => {
        if (document.visibilityState === 'visible') this.schedulePull();
      };
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
      document.addEventListener('visibilitychange', visible);
      this.cleanups.push(() => {
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
        document.removeEventListener('visibilitychange', visible);
      });
    }
    void this.syncNow();
  }

  /** Something was written to the outbox: push soon (edits in quick succession travel together). */
  poke(): void {
    void this.refreshPending();
    if (!this.leader || this.stopped || this.opts.manual) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow({ pull: false });
    }, this.opts.pushDelayMs ?? 250);
  }

  private schedulePull() {
    if (!this.leader || this.stopped) return;
    void this.syncNow({ push: false });
  }

  /** Push everything, then pull. Failures are retried with growing pauses (1 s … 60 s). */
  syncNow(opts: { push?: boolean; pull?: boolean } = {}): Promise<void> {
    return this.run(async () => {
      if (this.stopped && !this.opts.manual) return;
      if (!this.online()) {
        this.setStatus({ state: 'offline' });
        return;
      }
      this.setStatus({ state: 'syncing', retryAt: null });
      try {
        if (opts.push !== false) while (await this.pushOnce());
        if (opts.pull !== false) await this.pullOnce();
        this.failures = 0;
        await this.refreshPending();
        this.setStatus({ state: 'idle', lastSyncAt: this.now(), retryAt: null });
      } catch (error) {
        this.onFailure(error);
      }
    });
  }

  private onFailure(error: unknown) {
    const kind: TransportFailure = error instanceof TransportError ? error.kind : 'server';
    if (kind === 'auth') {
      this.setStatus({ state: 'auth', retryAt: null });
      return;
    }
    this.failures += 1;
    const delay = Math.min(MAX_BACKOFF, 1000 * 2 ** (this.failures - 1)) * (0.8 + Math.random() * 0.4);
    const retryAt = this.now() + delay;
    this.setStatus({ state: !this.online() || kind === 'network' ? 'offline' : 'error', retryAt });
    if (this.opts.manual || this.stopped) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delay);
  }

  // ------------------------------------------------------------------ push ---
  /** Sends one batch; returns whether anything was sent. */
  async pushOnce(): Promise<boolean> {
    const db = this.db;
    const batch = await db.transaction('rw', db.outbox, async () => {
      const items = await db.outbox.orderBy('seq').limit(this.opts.batchSize ?? 100).toArray();
      for (const m of items) {
        if (m.sealed === 0) {
          m.sealed = 1;
          await db.outbox.put(m);
        }
      }
      return items;
    });
    if (batch.length === 0) return false;

    const results = await this.transport.push(
      batch.map(({ id, entity, op, row_id, data, base, ts }) => ({ id, entity, op, row_id, data, base, ts })),
    );
    if (!Array.isArray(results) || results.length !== batch.length) {
      throw new TransportError('server', 'push_result_mismatch');
    }

    const conflicts: ConflictNotice[] = [];
    const rejected: RejectedNotice[] = [];
    await db.transaction('rw', SYNC_TABLES(db), async () => {
      const keys: RowKey[] = [];
      for (let i = 0; i < batch.length; i += 1) {
        const m = batch[i]!;
        const r = results[i]!;
        if (r.id !== m.id) throw new TransportError('server', 'push_result_order');
        await db.outbox.delete(m.seq!);
        keys.push([m.entity, m.row_id]);
        if (r.row) {
          keys.push(...(await acceptRows(db, m.entity, [r.row])));
        } else if (m.op === 'delete' && r.status !== 'rejected') {
          keys.push(...(await dropRow(db, m.entity, m.row_id)));
        }
        const decision = r.status === 'duplicate' ? r.decision : r.status;
        if (decision === 'rejected') {
          rejected.push({ entity: m.entity, rowId: m.row_id, op: m.op, error: r.error ?? 'rejected' });
        }
        const lost = (r.conflicts ?? []).filter((c) => c.winner === 'server');
        if (lost.length) conflicts.push({ entity: m.entity, rowId: m.row_id, fields: lost });
      }
      await rebase(db, keys);
    });
    await this.refreshPending();
    for (const c of conflicts) this.opts.onConflict?.(c);
    for (const r of rejected) this.opts.onRejected?.(r);
    return true;
  }

  // ------------------------------------------------------------------ pull ---
  async pullOnce(): Promise<void> {
    const db = this.db;
    const cursor = (await db.meta.get('cursor'))?.value as string | undefined;
    if (!cursor) {
      await this.bootstrap();
      return;
    }
    const res = await this.transport.pull(cursor);
    if (res.reset || res.truncated || !res.cursor) {
      await this.bootstrap();
      return;
    }
    await db.transaction('rw', SYNC_TABLES(db), async () => {
      const keys: RowKey[] = [];
      for (const entity of entities) keys.push(...(await acceptRows(db, entity, res.changes?.[entity] ?? [])));
      const tombs = (res.tombstones ?? []).filter((t) => isEntity(t.entity));
      keys.push(...(await acceptTombstones(db, tombs, this.now())));
      await rebase(db, keys);
      await db.meta.put({ key: 'cursor', value: res.cursor });
    });
    await pruneTombstones(db, 7 * 86_400_000, this.now());
  }

  /** Full download, page by page, then continue from the cursor taken before it started. */
  async bootstrap(): Promise<void> {
    const db = this.db;
    const since = await this.transport.cursor();
    const page = this.opts.bootstrapPage ?? 1000;
    for (const entity of entities) {
      const seen = new Set<string>();
      let after: string | null = null;
      for (;;) {
        const rows = await this.transport.bootstrap(entity, after, page);
        for (const r of rows) seen.add(String(r.id));
        await db.transaction('rw', SYNC_TABLES(db), async () => {
          await rebase(db, await acceptRows(db, entity, rows));
        });
        if (rows.length < page) break;
        after = String(rows[rows.length - 1]!.id);
      }
      await db.transaction('rw', SYNC_TABLES(db), async () => {
        await rebase(db, await forgetMissing(db, entity, seen, since));
      });
    }
    await db.meta.put({ key: 'cursor', value: since });
    this.setStatus({ bootstrapped: true });
    // Catch whatever changed while the download ran.
    const res = await this.transport.pull(since);
    if (!res.reset && !res.truncated && res.cursor) {
      await db.transaction('rw', SYNC_TABLES(db), async () => {
        const keys: RowKey[] = [];
        for (const entity of entities) keys.push(...(await acceptRows(db, entity, res.changes?.[entity] ?? [])));
        keys.push(...(await acceptTombstones(db, (res.tombstones ?? []).filter((t) => isEntity(t.entity)), this.now())));
        await rebase(db, keys);
        await db.meta.put({ key: 'cursor', value: res.cursor });
      });
    }
  }

  // -------------------------------------------------------------- realtime ---
  async applyRealtimeRow(entity: Entity, row: Record<string, unknown>): Promise<void> {
    const db = this.db;
    await db.transaction('rw', SYNC_TABLES(db), async () => {
      await rebase(db, await acceptRows(db, entity, [row]));
    });
  }

  async applyRealtimeDelete(entity: Entity, id: string): Promise<void> {
    const db = this.db;
    await db.transaction('rw', SYNC_TABLES(db), async () => {
      await rebase(db, await dropRow(db, entity, id));
    });
    this.schedulePull();
  }
}
