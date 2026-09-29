import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { VeritasDB } from '@/lib/db/schema';
import { SyncEngine } from '@/lib/sync/engine';
import { Repo } from '@/lib/sync/repo';
import { FakeServer, FlakyTransport, type Fault } from './support/fake-server';

/**
 * Random stress: three devices of one person do random things while the
 * network drops requests, loses answers and delivers batches twice. After
 * the network heals, every device must hold exactly the server's data:
 * no task lost, none duplicated, every progress event counted once.
 */
const OWNER = '00000000-0000-4000-8000-000000000001';
const FIELDS = ['title', 'due_date', 'estimate_minutes', 'description_text'] as const;

type Step =
  | { t: 'create'; dev: number }
  | { t: 'edit'; dev: number; pick: number; field: (typeof FIELDS)[number]; value: number }
  | { t: 'trash'; dev: number; pick: number; on: boolean }
  | { t: 'purge'; dev: number; pick: number }
  | { t: 'event'; dev: number; pick: number }
  | { t: 'sync'; dev: number; fault: Fault | null }
  | { t: 'pull'; dev: number }
  | { t: 'network'; dev: number; online: boolean };

const dev = fc.integer({ min: 0, max: 2 });
const pick = fc.nat({ max: 20 });
const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ t: fc.constant('create' as const), dev }) },
  { weight: 5, arbitrary: fc.record({ t: fc.constant('edit' as const), dev, pick, field: fc.constantFrom(...FIELDS), value: fc.nat({ max: 50 }) }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('trash' as const), dev, pick, on: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('purge' as const), dev, pick }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('event' as const), dev, pick }) },
  {
    weight: 4,
    arbitrary: fc.record({ t: fc.constant('sync' as const), dev, fault: fc.constantFrom<Fault | null>(null, null, 'drop-request', 'drop-response', 'duplicate') }),
  },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('pull' as const), dev }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('network' as const), dev, online: fc.boolean() }) },
);

let runs = 0;

async function scenario(steps: Step[]) {
  runs += 1;
  const server = new FakeServer();
  let t = 1_700_000_000_000;
  const devices = [0, 1, 2].map((i) => {
    const db = new VeritasDB(`prop-${runs}-${i}`);
    const transport = new FlakyTransport(server);
    const engine = new SyncEngine({ db, transport, manual: true, isOnline: () => !transport.offline });
    const repo = new Repo({ db, now: () => (t += 3) });
    return { db, transport, engine, repo };
  });
  const created = new Set<string>();
  const purged = new Set<string>();
  const events = new Map<string, Set<string>>();

  const visible = async (i: number) => (await devices[i]!.db.tasks.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const s of steps) {
    const d = devices[s.dev]!;
    switch (s.t) {
      case 'create': {
        const { row } = await d.repo.insert('tasks', { owner_id: OWNER, title: `t${created.size}`, type: 'normal', timezone: 'UTC', sort_key: 'a0' } as never);
        created.add(String(row!.id));
        break;
      }
      case 'edit': {
        const list = await visible(s.dev);
        const task = list[s.pick % Math.max(1, list.length)];
        if (!task) break;
        const value =
          s.field === 'due_date' ? `2026-10-${String((s.value % 28) + 1).padStart(2, '0')}` : s.field === 'estimate_minutes' ? s.value : `v${s.value}`;
        await d.repo.update('tasks', String(task.id), { [s.field]: value });
        break;
      }
      case 'trash': {
        const list = await visible(s.dev);
        const task = list[s.pick % Math.max(1, list.length)];
        if (task) await d.repo.update('tasks', String(task.id), { deleted_at: s.on ? new Date(t).toISOString() : null });
        break;
      }
      case 'purge': {
        const list = await visible(s.dev);
        const task = list[s.pick % Math.max(1, list.length)];
        if (task) {
          await d.repo.remove('tasks', String(task.id));
          purged.add(String(task.id));
        }
        break;
      }
      case 'event': {
        const list = await visible(s.dev);
        const task = list[s.pick % Math.max(1, list.length)];
        if (!task) break;
        const { row } = await d.repo.insert('progress_events', {
          task_id: task.id, user_id: OWNER, kind: 'delta', value: 1, occurred_at: new Date(t).toISOString(),
        } as never);
        const set = events.get(String(task.id)) ?? new Set<string>();
        set.add(String(row!.id));
        events.set(String(task.id), set);
        break;
      }
      case 'sync':
        if (s.fault) d.transport.faults.push(s.fault);
        await d.engine.syncNow();
        break;
      case 'pull':
        await d.engine.syncNow({ push: false });
        break;
      case 'network':
        d.transport.offline = !s.online;
        break;
    }
  }

  // The network heals; everyone syncs a few rounds.
  for (const d of devices) {
    d.transport.offline = false;
    d.transport.faults.length = 0;
  }
  for (let round = 0; round < 3; round += 1) for (const d of devices) await d.engine.syncNow();

  const serverTasks = server.rows('tasks').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const expectedIds = [...created].filter((id) => !purged.has(id)).sort();

  // No task lost, none duplicated.
  expect(serverTasks.map((r) => r.id)).toEqual(expectedIds);
  for (const [i, d] of devices.entries()) {
    expect(await d.db.outbox.count(), `device ${i} still has unsent changes`).toBe(0);
    expect(await visible(i), `device ${i} differs from the server`).toEqual(serverTasks);
  }
  // Every progress event of a surviving task counted exactly once, on every device.
  const serverEvents = server.rows('progress_events');
  for (const id of expectedIds) {
    const want = [...(events.get(id) ?? [])].sort();
    expect(serverEvents.filter((e) => e.task_id === id).map((e) => e.id).sort()).toEqual(want);
    for (const d of devices) {
      expect((await d.db.progress_events.where('task_id').equals(id).primaryKeys()).sort()).toEqual(want);
    }
  }
  for (const d of devices) d.db.close();
}

describe('sync: random stress with a flaky network', () => {
  it('three devices always converge, with nothing lost or duplicated', async () => {
    await fc.assert(fc.asyncProperty(fc.array(step, { minLength: 5, maxLength: 45 }), scenario), { numRuns: Number(process.env.SYNC_STRESS_RUNS ?? 150) });
  }, 900_000);
});
