import { describe, expect, it } from 'vitest';
import { enqueue } from '@/lib/sync/local';
import { adminRows, createUser, device, newTask, settle, signIn } from './support';

/**
 * The owner's mandatory sync scenarios (PLAN.md §19.7), against the real
 * local Supabase: sync_push / sync_pull, RLS, triggers, tombstones.
 */
describe('sync against the real database', () => {
  it('offline creation on two devices: both tasks arrive once', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const b = device(await signIn(user.email, user.password));
    a.transport.offline = true;
    b.transport.offline = true;
    const ta = await newTask(a, user.id, 'С ноутбука');
    const tb = await newTask(b, user.id, 'С телефона');
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    const server = await adminRows('tasks', `owner_id=eq.${user.id}&select=id,title&order=id`);
    expect(server.map((r) => r.id)).toEqual([ta.id, tb.id].sort());
    expect((await b.db.tasks.toArray()).map((r) => r.id).sort()).toEqual([ta.id, tb.id].sort());
  });

  it('answer lost: the retry is recognised, the task exists once and was created once', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const task = await newTask(a, user.id, 'Потерянный ответ');
    a.transport.faults.push('drop-response');
    await a.engine.syncNow();
    expect(await a.db.outbox.count()).toBe(1);
    await a.engine.syncNow();
    expect(await a.db.outbox.count()).toBe(0);
    expect(await adminRows('tasks', `id=eq.${task.id}&select=version`)).toEqual([{ version: 1 }]);
    expect(await adminRows('activity_log', `task_id=eq.${task.id}&action=eq.created&select=id`)).toHaveLength(1);
  });

  it('a batch delivered twice is applied once', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const task = await newTask(a, user.id, 'Двойная доставка', { type: 'counter' });
    await a.repo.insert('progress_events', { task_id: task.id, user_id: user.id, kind: 'delta', value: 1 } as never);
    a.transport.faults.push('duplicate');
    await a.engine.syncNow();
    expect(await adminRows('progress_events', `task_id=eq.${task.id}&select=id`)).toHaveLength(1);
  });

  it('same field on two devices: the later edit wins everywhere; the loser is told; history keeps both', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const b = device(await signIn(user.email, user.password));
    const task = await newTask(a, user.id, 'Исходное');
    await settle(a, b);
    a.transport.offline = true;
    b.transport.offline = true;
    await a.repo.update('tasks', task.id, { title: 'A раньше' });
    await b.repo.update('tasks', task.id, { title: 'B позже' });
    a.transport.offline = false;
    b.transport.offline = false;
    await b.engine.syncNow();
    await a.engine.syncNow();
    await settle(a, b);
    for (const d of [a, b]) expect((await d.db.tasks.get(task.id))?.title).toBe('B позже');
    expect(a.conflicts[0]?.fields[0]).toMatchObject({ field: 'title', lost: 'A раньше', winner: 'server' });
    const log = await adminRows('activity_log', `task_id=eq.${task.id}&action=eq.conflict&select=diff`);
    expect(JSON.stringify(log)).toContain('A раньше');
  });

  it('different fields on two devices: both kept', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const b = device(await signIn(user.email, user.password));
    const task = await newTask(a, user.id, 'Поля');
    await settle(a, b);
    a.transport.offline = true;
    b.transport.offline = true;
    await a.repo.update('tasks', task.id, { due_date: '2026-10-05', due_time: '09:30' });
    await b.repo.update('tasks', task.id, { estimate_minutes: 45 });
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    for (const d of [a, b]) {
      expect(await d.db.tasks.get(task.id)).toMatchObject({ due_date: '2026-10-05', due_time: '09:30:00', estimate_minutes: 45 });
    }
  });

  it('deleted on one device, edited on the other: the edit is in the trash', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const b = device(await signIn(user.email, user.password));
    const task = await newTask(a, user.id, 'Удалить');
    await settle(a, b);
    a.transport.offline = true;
    b.transport.offline = true;
    await a.repo.update('tasks', task.id, { deleted_at: new Date().toISOString() });
    await b.repo.update('tasks', task.id, { title: 'Правка не потеряна' });
    a.transport.offline = false;
    b.transport.offline = false;
    await settle(a, b);
    const [row] = await adminRows('tasks', `id=eq.${task.id}&select=title,deleted_at`);
    expect(row).toMatchObject({ title: 'Правка не потеряна' });
    expect(row!.deleted_at).not.toBeNull();
    expect((await a.db.tasks.get(task.id))?.title).toBe('Правка не потеряна');
  });

  it('purge reaches the other device with the task parts; a late retry does not resurrect it', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const b = device(await signIn(user.email, user.password));
    const task = await newTask(a, user.id, 'Стереть');
    await a.repo.insert('task_milestones', { task_id: task.id, created_by: user.id, title: 'Шаг', sort_key: 'a0' } as never);
    a.transport.faults.push('drop-response');
    await a.engine.syncNow(); // applied, answer lost
    await b.engine.syncNow();
    expect(await b.db.task_milestones.count()).toBe(1);
    await b.repo.remove('tasks', task.id);
    await b.engine.syncNow();
    await a.engine.syncNow(); // A resends the insert: remembered as applied
    await settle(a, b);
    expect(await adminRows('tasks', `id=eq.${task.id}&select=id`)).toHaveLength(0);
    for (const d of [a, b]) {
      expect(await d.db.tasks.get(task.id)).toBeUndefined();
      expect(await d.db.task_milestones.count()).toBe(0);
    }
  });

  it('a new device downloads everything page by page', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    for (let i = 0; i < 7; i += 1) await newTask(a, user.id, `Задача ${i}`);
    await a.engine.syncNow();
    const b = device(await signIn(user.email, user.password), { bootstrapPage: 3 });
    await b.engine.syncNow();
    expect(await b.db.tasks.count()).toBe(7);
    expect(await b.db.statuses.count()).toBe(5); // system statuses arrive too
  });

  it('another person never receives my data', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const a = device(await signIn(alice.email, alice.password));
    await newTask(a, alice.id, 'Личное');
    await a.engine.syncNow();
    const b = device(await signIn(bob.email, bob.password));
    await b.engine.syncNow();
    expect(await b.db.tasks.count()).toBe(0);
    // And cannot write into it either, even with a forged change.
    const [row] = await adminRows('tasks', `owner_id=eq.${alice.id}&select=id`);
    await enqueue(b.db, { entity: 'tasks', op: 'update', row_id: String(row!.id), data: { title: 'взлом' }, base: {} });
    await b.engine.syncNow();
    expect(b.rejected[0]?.error).toMatch(/not_found/);
    expect((await adminRows('tasks', `id=eq.${row!.id}&select=title`))[0]).toMatchObject({ title: 'Личное' });
  });

  it('realtime: a change on one device appears on the other without asking', async () => {
    const user = await createUser();
    const a = device(await signIn(user.email, user.password));
    const clientB = await signIn(user.email, user.password);
    const b = device(clientB);
    await b.engine.syncNow();
    const { supabaseTransport } = await import('@/lib/sync/supabase-transport');
    const subscribed = new Promise<void>((resolve) => {
      const off = supabaseTransport(clientB, 'rt-test').subscribe!({
        onRow: (entity, row) => void b.engine.applyRealtimeRow(entity, row),
        onDelete: (entity, id) => void b.engine.applyRealtimeDelete(entity, id),
        onReconnect: () => resolve(),
      });
      setTimeout(() => off, 30_000);
    });
    await subscribed;
    const task = await newTask(a, user.id, 'Живое обновление');
    await a.engine.syncNow();
    // Realtime reads the database log in order; after busy tests it may lag a few seconds.
    const deadline = Date.now() + 25_000;
    while (!(await b.db.tasks.get(task.id)) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    expect((await b.db.tasks.get(task.id))?.title).toBe('Живое обновление');
    await clientB.removeAllChannels();
  });
});
