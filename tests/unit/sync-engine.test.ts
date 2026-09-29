import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { VeritasDB } from '@/lib/db/schema';
import type { AnyRow } from '@/lib/db/types';
import { SyncEngine, type ConflictNotice, type RejectedNotice } from '@/lib/sync/engine';
import { Repo } from '@/lib/sync/repo';
import { FakeServer, FlakyTransport } from './support/fake-server';

const OWNER = '00000000-0000-4000-8000-000000000001';
let dbCounter = 0;

function clock(start = 1_700_000_000_000) {
  let t = start;
  return { now: () => t, tick: () => (t += 7), set: (v: number) => (t = v) };
}

function device(server: FakeServer, time = clock()) {
  const db = new VeritasDB(`sync-test-${(dbCounter += 1)}`);
  const transport = new FlakyTransport(server);
  const conflicts: ConflictNotice[] = [];
  const rejected: RejectedNotice[] = [];
  const engine = new SyncEngine({
    db,
    transport,
    manual: true,
    now: time.now,
    isOnline: () => !transport.offline,
    onConflict: (c) => conflicts.push(c),
    onRejected: (r) => rejected.push(r),
  });
  const repo = new Repo({ db, now: time.tick });
  return { db, transport, engine, repo, conflicts, rejected, time };
}

async function newTask(repo: Repo, title: string, extra: Record<string, unknown> = {}) {
  const { row } = await repo.insert('tasks', {
    owner_id: OWNER,
    title,
    type: 'normal',
    timezone: 'Europe/Moscow',
    sort_key: 'a0',
    ...extra,
  } as never);
  return row as AnyRow;
}

async function tasks(db: VeritasDB) {
  return (await db.tasks.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function settle(...devices: ReturnType<typeof device>[]) {
  for (let round = 0; round < 2; round += 1) {
    for (const d of devices) await d.engine.syncNow();
  }
}

describe('sync engine', () => {
  it('first sign-in on a device downloads everything', async () => {
    const server = new FakeServer();
    const a = device(server);
    await newTask(a.repo, 'Первая');
    await a.engine.syncNow();
    const b = device(server);
    await b.engine.syncNow();
    expect((await tasks(b.db)).map((t) => t.title)).toEqual(['Первая']);
  });

  it('tasks created offline on two devices both arrive, once each', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    a.transport.offline = true;
    b.transport.offline = true;
    const ta = await newTask(a.repo, 'С ноутбука');
    const tb = await newTask(b.repo, 'С телефона');
    await a.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(0);
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    expect(server.rows('tasks')).toHaveLength(2);
    expect((await tasks(a.db)).map((x) => x.id)).toEqual([ta.id, tb.id].sort());
    expect((await tasks(b.db)).map((x) => x.id)).toEqual([ta.id, tb.id].sort());
    expect(await a.db.outbox.count()).toBe(0);
  });

  it('answer lost after the server applied the change: the retry creates no duplicate', async () => {
    const server = new FakeServer();
    const a = device(server);
    await newTask(a.repo, 'Не потерять');
    a.transport.faults.push('drop-response');
    await a.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(1);
    expect(await a.db.outbox.count()).toBe(1); // the device does not know yet
    await a.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(1);
    expect(server.applyCount).toBe(1);
    expect(await a.db.outbox.count()).toBe(0);
  });

  it('a purged task is not brought back by a late retry from another device', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Вернётся?');
    a.transport.faults.push('drop-response'); // applied, but A does not know
    await a.engine.syncNow();
    await b.engine.syncNow();
    await b.repo.remove('tasks', task.id);
    await b.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(0);
    await a.engine.syncNow(); // A retries its insert: the server remembers it was applied
    await settle(a, b);
    expect(server.rows('tasks')).toHaveLength(0);
    expect(await a.db.tasks.count()).toBe(0);
  });

  it('a request lost on the way is simply sent again', async () => {
    const server = new FakeServer();
    const a = device(server);
    await newTask(a.repo, 'Отправить');
    a.transport.faults.push('drop-request');
    await a.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(0);
    await a.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(1);
  });

  it('the same batch delivered twice is applied once', async () => {
    const server = new FakeServer();
    const a = device(server);
    const task = await newTask(a.repo, 'Дважды');
    await a.repo.insert('progress_events', { task_id: task.id, user_id: OWNER, kind: 'delta', value: 1, occurred_at: new Date().toISOString() } as never);
    a.transport.faults.push('duplicate');
    await a.engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(1);
    expect(server.rows('progress_events')).toHaveLength(1);
  });

  it('page reload in the middle of a sync: the new page resends, nothing doubles', async () => {
    const server = new FakeServer();
    const a = device(server);
    await newTask(a.repo, 'Перезагрузка');
    a.transport.faults.push('drop-response'); // sent and applied, the page is gone before the answer
    await a.engine.syncNow();
    await a.engine.stop();
    const name = a.db.name;
    a.db.close();

    const reopened = new VeritasDB(name);
    const transport = new FlakyTransport(server);
    const engine = new SyncEngine({ db: reopened, transport, manual: true });
    await engine.syncNow();
    expect(server.rows('tasks')).toHaveLength(1);
    expect(await reopened.outbox.count()).toBe(0);
    expect((await reopened.tasks.toArray()).map((t) => t.title)).toEqual(['Перезагрузка']);
  });

  it('two devices edit the same field: the later edit wins everywhere, the other side is told', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Исходное');
    await settle(a, b);

    a.transport.offline = true;
    b.transport.offline = true;
    await a.repo.update('tasks', task.id, { title: 'Правка A (раньше)' });
    await b.repo.update('tasks', task.id, { title: 'Правка B (позже)' });
    a.transport.offline = false;
    b.transport.offline = false;
    await b.engine.syncNow();
    await a.engine.syncNow();
    await settle(a, b);

    for (const d of [a, b]) expect((await d.db.tasks.get(task.id))?.title).toBe('Правка B (позже)');
    expect(a.conflicts).toHaveLength(1);
    expect(a.conflicts[0]!.fields[0]).toMatchObject({ field: 'title', lost: 'Правка A (раньше)', winner: 'server' });
    expect(server.conflictLog.at(-1)).toMatchObject({ kept: 'Правка B (позже)', lost: 'Правка A (раньше)' });
  });

  it('two devices edit different fields: both edits are kept', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Поля');
    await settle(a, b);
    a.transport.offline = true;
    b.transport.offline = true;
    await a.repo.update('tasks', task.id, { due_date: '2026-10-05' });
    await b.repo.update('tasks', task.id, { description_text: 'детали' });
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    for (const d of [a, b]) {
      expect(await d.db.tasks.get(task.id)).toMatchObject({ due_date: '2026-10-05', description_text: 'детали' });
    }
    expect(a.conflicts).toHaveLength(0);
    expect(b.conflicts).toHaveLength(0);
  });

  it('deleted on one device, edited on another: the edit survives in the trash', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Удалить?');
    await settle(a, b);
    a.transport.offline = true;
    b.transport.offline = true;
    await a.repo.update('tasks', task.id, { deleted_at: '2026-09-30T10:00:00.000Z' });
    await b.repo.update('tasks', task.id, { title: 'Важная правка' });
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    for (const d of [a, b]) {
      expect(await d.db.tasks.get(task.id)).toMatchObject({ title: 'Важная правка', deleted_at: '2026-09-30T10:00:00.000Z' });
    }
  });

  it('a permanent delete reaches the other device, together with the task parts', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Стереть');
    await a.repo.insert('task_milestones', { task_id: task.id, created_by: OWNER, title: 'Этап', weight: 50, sort_key: 'a0' } as never);
    await settle(a, b);
    expect(await b.db.task_milestones.count()).toBe(1);
    await a.repo.remove('tasks', task.id);
    await settle(a, b);
    expect(await b.db.tasks.get(task.id)).toBeUndefined();
    expect(await b.db.task_milestones.count()).toBe(0);
    expect(server.rows('tasks')).toHaveLength(0);
  });

  it('unsent local edits stay on top of changes arriving from the server', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Слои');
    await settle(a, b);
    b.transport.offline = true;
    await b.repo.update('tasks', task.id, { title: 'Локально на B' });
    await a.repo.update('tasks', task.id, { estimate_minutes: 25 });
    await a.engine.syncNow();
    b.transport.offline = false;
    await b.engine.pullOnce(); // pull before B's own push
    expect(await b.db.tasks.get(task.id)).toMatchObject({ title: 'Локально на B', estimate_minutes: 25 });
    await settle(a, b);
    expect(await a.db.tasks.get(task.id)).toMatchObject({ title: 'Локально на B', estimate_minutes: 25 });
  });

  it('quick successive edits travel as one change; after a push starts, a new one is made', async () => {
    const server = new FakeServer();
    const a = device(server);
    const task = await newTask(a.repo, 'Набор');
    await a.repo.update('tasks', task.id, { title: 'Набор т' });
    await a.repo.update('tasks', task.id, { title: 'Набор текста' });
    expect(await a.db.outbox.count()).toBe(1); // merged into the unsent insert
    await a.engine.syncNow();
    await a.repo.update('tasks', task.id, { title: 'Набор текста!' });
    await a.db.outbox.toCollection().modify({ sealed: 1 });
    await a.repo.update('tasks', task.id, { title: 'Набор текста!!' });
    expect(await a.db.outbox.count()).toBe(2);
    await a.engine.syncNow();
    expect(server.rows('tasks')[0]).toMatchObject({ title: 'Набор текста!!' });
  });

  it('progress from two offline devices adds up (+1 and +1 = +2)', async () => {
    const server = new FakeServer();
    const t = clock();
    const a = device(server, t);
    const b = device(server, t);
    const task = await newTask(a.repo, 'Счётчик', { type: 'counter' });
    await settle(a, b);
    a.transport.offline = true;
    b.transport.offline = true;
    for (const d of [a, b]) {
      await d.repo.insert('progress_events', { task_id: task.id, user_id: OWNER, kind: 'delta', value: 1, occurred_at: '2026-09-30T10:00:00.000Z' } as never);
    }
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    for (const d of [a, b]) {
      const events = await d.db.progress_events.where('task_id').equals(task.id).toArray();
      expect(events.reduce((s, e) => s + Number(e.value), 0)).toBe(2);
    }
  });

  it('a change the server refuses is dropped, reported and rolled back on screen', async () => {
    const server = new FakeServer();
    const a = device(server);
    const task = await newTask(a.repo, 'Норма');
    await a.engine.syncNow();
    await a.repo.update('tasks', task.id, { owner_id: 'someone-else' } as never);
    await a.engine.syncNow();
    expect(a.rejected).toHaveLength(1);
    expect(await a.db.outbox.count()).toBe(0);
    expect((await a.db.tasks.get(task.id))?.owner_id).toBe(OWNER);
  });

  it('undo writes the inverse change', async () => {
    const server = new FakeServer();
    const a = device(server);
    const task = await newTask(a.repo, 'Было');
    const { inverse } = await a.repo.update('tasks', task.id, { title: 'Стало', due_date: '2026-10-10' });
    await a.repo.apply(inverse);
    expect(await a.db.tasks.get(task.id)).toMatchObject({ title: 'Было', due_date: null });
    await a.engine.syncNow();
    expect(server.rows('tasks')[0]).toMatchObject({ title: 'Было', due_date: null });
  });
});
