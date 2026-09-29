import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMilestone,
  completeTask,
  createTask,
  duplicateTask,
  ensureProject,
  ensureTag,
  reopenTask,
  restoreTask,
  setHabitDay,
  setTaskTags,
  trashTask,
  type ActionContext,
} from '@/features/tasks/data/actions';
import { applyTemplate, payloadFromTask, templatePayloadSchema } from '@/features/tasks/templates/payload';
import { VeritasDB } from '@/lib/db/schema';
import type { AnyRow, MilestoneRow, TagRow, TaskRow } from '@/lib/db/types';
import { presets } from '@/lib/domain/recurrence';
import { Repo } from '@/lib/sync/repo';

const USER = '00000000-0000-4000-8000-00000000000a';
let n = 0;

async function setup(now = new Date('2026-09-29T09:00:00Z')) {
  n += 1;
  const db = new VeritasDB(`actions-${n}`);
  // The default catalog the server creates for every account.
  const catalog: AnyRow[] = [
    { id: 's-todo', owner_id: USER, system_key: 'todo', category: 'todo', color: 'slate', sort_key: 'a0', deleted_at: null },
    { id: 's-done', owner_id: USER, system_key: 'done', category: 'done', color: 'mint', sort_key: 'a3', deleted_at: null },
  ];
  await db.statuses.bulkPut(catalog);
  await db.priorities.bulkPut([
    { id: 'p-high', owner_id: USER, system_key: 'high', rank: 2, color: 'high', deleted_at: null },
    { id: 'p-low', owner_id: USER, system_key: 'low', rank: 4, color: 'low', deleted_at: null },
  ]);
  let clock = now.getTime();
  const repo = new Repo({ db, now: () => (clock += 10) });
  const ctx: ActionContext = { repo, userId: USER, timeZone: 'Europe/Moscow', weekStart: 1, now: () => now };
  return { db, repo, ctx };
}

const get = async (db: VeritasDB, id: string) => (await db.tasks.get(id)) as unknown as TaskRow;

describe('creating tasks', () => {
  let env: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    env = await setup();
  });

  it('fills the defaults: to-do status, priority by key, the end of the list, tags, reminders', async () => {
    const first = await createTask(env.ctx, { title: '  Первая  ' });
    const second = await createTask(env.ctx, { title: 'Вторая', priority: 'high', tags: ['дом', 'Дом'], reminders: [30, 0] });
    const a = await get(env.db, first.task.id);
    const b = await get(env.db, second.task.id);
    expect(a).toMatchObject({ title: 'Первая', status_id: 's-todo', priority_id: null, timezone: 'Europe/Moscow', owner_id: USER });
    expect(b).toMatchObject({ priority_id: 'p-high', reminders: [{ before: 30 }, { before: 0 }] });
    expect(b.sort_key > a.sort_key).toBe(true);
    // "дом" and "Дом" are one tag.
    expect(await env.db.tags.count()).toBe(1);
    expect(await env.db.task_tags.where('task_id').equals(b.id).count()).toBe(1);
  });

  it('a time without a date is dropped; times get seconds', async () => {
    const { task } = await createTask(env.ctx, { title: 'Созвон', due_date: '2026-10-01', due_time: '18:30' });
    expect((await get(env.db, task.id)).due_time).toBe('18:30:00');
    const loose = await createTask(env.ctx, { title: 'Без даты', due_time: '18:30' });
    expect((await get(env.db, loose.task.id)).due_time).toBeNull();
  });

  it('undo removes the new task', async () => {
    const { task, inverse } = await createTask(env.ctx, { title: 'Ошибка' });
    await env.repo.apply(inverse);
    expect(await env.db.tasks.get(task.id)).toBeUndefined();
  });
});

describe('completing', () => {
  it('a one-off task closes, records the completion and can be undone', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, { title: 'Закрыть', due_date: '2026-09-29', due_time: '18:00' });
    const outcome = await completeTask(env.ctx, task);
    const closed = await get(env.db, task.id);
    expect(outcome.nextDue).toBeNull();
    expect(closed.completed_at).not.toBeNull();
    expect(closed.status_id).toBe('s-done');
    const [completion] = await env.db.task_completions.toArray();
    // Done at 12:00 Moscow, due 18:00: on time.
    expect(completion).toMatchObject({ task_id: task.id, on_time: true, occurrence_date: null, deleted_at: null });

    await env.repo.apply(outcome.inverse);
    const back = await get(env.db, task.id);
    expect(back.completed_at).toBeNull();
    expect(back.status_id).toBe('s-todo');
    expect((await env.db.task_completions.toArray())[0]!.deleted_at).not.toBeNull();
  });

  it('a repeating task moves to the next date and keeps its start-to-deadline span', async () => {
    const env = await setup();
    const rule = presets.weekly('2026-09-25', [5]); // Fridays
    const { task } = await createTask(env.ctx, {
      title: 'Обзор недели',
      type: 'percent',
      due_date: '2026-09-25',
      start_date: '2026-09-23',
      recurrence: rule,
    });
    await env.repo.update('tasks', task.id, { progress_current: 60 });
    const fresh = await get(env.db, task.id);
    const outcome = await completeTask(env.ctx, fresh);
    const moved = await get(env.db, task.id);
    // The missed Friday (25th) is skipped: the next one after today (29th) is October 2.
    expect(outcome.nextDue).toBe('2026-10-02');
    expect(moved).toMatchObject({ due_date: '2026-10-02', start_date: '2026-09-30', completed_at: null, progress_current: 0 });
    expect((await env.db.task_completions.toArray())[0]).toMatchObject({ occurrence_date: '2026-09-25' });

    await env.repo.apply(outcome.inverse);
    expect(await get(env.db, task.id)).toMatchObject({ due_date: '2026-09-25', start_date: '2026-09-23', progress_current: 60 });
  });

  it('"from completion" repeats count from the day it was done', async () => {
    const env = await setup();
    const rule = { ...presets.daily('2026-09-20', 3), mode: 'completion' as const };
    const { task } = await createTask(env.ctx, { title: 'Полить цветы', due_date: '2026-09-20', recurrence: rule });
    const outcome = await completeTask(env.ctx, task);
    expect(outcome.nextDue).toBe('2026-10-02');
  });

  it('reopening removes the latest completion', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, { title: 'Вернуть' });
    await completeTask(env.ctx, task);
    await reopenTask(env.ctx, await get(env.db, task.id));
    expect((await get(env.db, task.id)).completed_at).toBeNull();
    expect((await env.db.task_completions.toArray()).every((c) => c.deleted_at)).toBe(true);
  });
});

describe('trash, tags, habits', () => {
  it('trash and restore are reversible edits', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, { title: 'Корзина' });
    const undo = await trashTask(env.ctx, task.id);
    expect((await get(env.db, task.id)).deleted_at).not.toBeNull();
    await env.repo.apply(undo);
    expect((await get(env.db, task.id)).deleted_at).toBeNull();
    await trashTask(env.ctx, task.id);
    await restoreTask(env.ctx, task.id);
    expect((await get(env.db, task.id)).deleted_at).toBeNull();
  });

  it('the same new tag on two offline devices gets the same id (so it merges into one)', async () => {
    const a = await setup();
    const b = await setup();
    expect(await ensureTag(a.ctx, '#Спорт')).toBe(await ensureTag(b.ctx, 'Спорт'));
    const tag = (await a.db.tags.toArray())[0] as unknown as TagRow;
    expect(tag.name).toBe('Спорт');
    expect(tag.color).not.toBe('slate');
  });

  it('setting tags reuses links: removing and adding back restores the same row', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, { title: 'Теги', tags: ['a', 'b'] });
    await setTaskTags(env.ctx, task.id, ['a']);
    let links = await env.db.task_tags.where('task_id').equals(task.id).toArray();
    expect(links.filter((l) => !l.deleted_at)).toHaveLength(1);
    await setTaskTags(env.ctx, task.id, ['a', 'b']);
    links = await env.db.task_tags.where('task_id').equals(task.id).toArray();
    expect(links).toHaveLength(2);
    expect(links.every((l) => !l.deleted_at)).toBe(true);
  });

  it('a habit day has one row per date; clearing it soft-deletes, marking again revives', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, { title: 'Зарядка', type: 'habit' });
    await setHabitDay(env.ctx, task.id, '2026-09-29', 'done');
    await setHabitDay(env.ctx, task.id, '2026-09-29', null);
    await setHabitDay(env.ctx, task.id, '2026-09-29', 'freeze');
    const logs = await env.db.habit_logs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'freeze', deleted_at: null, date: '2026-09-29' });
  });

  it('projects are found by name (any case) or created once', async () => {
    const env = await setup();
    const id = await ensureProject(env.ctx, '+"Дом и дача"');
    expect(await ensureProject(env.ctx, 'дом и дача')).toBe(id);
    expect(await env.db.projects.count()).toBe(1);
    expect((await env.db.projects.get(id))?.name).toBe('Дом и дача');
  });
});

describe('duplicate and templates', () => {
  it('duplicating copies stages, tags and subtasks with new ids', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, { title: 'Запуск', type: 'stages', tags: ['работа'] });
    await addMilestone(env.ctx, task.id, 'Дизайн', 50);
    await addMilestone(env.ctx, task.id, 'Код', 50);
    await createTask(env.ctx, { title: 'Подзадача', parent_id: task.id });
    const { id, inverse } = await duplicateTask(env.ctx, task.id, ' (копия)');
    const copy = await get(env.db, id);
    expect(copy.title).toBe('Запуск (копия)');
    expect(copy.id).not.toBe(task.id);
    expect(await env.db.task_milestones.where('task_id').equals(id).count()).toBe(2);
    expect(await env.db.task_tags.where('task_id').equals(id).count()).toBe(1);
    expect(await env.db.tasks.where('parent_id').equals(id).count()).toBe(1);
    await env.repo.apply(inverse);
    expect(await env.db.tasks.get(id)).toBeUndefined();
  });

  it('a template saved from a task recreates it (without dates or progress)', async () => {
    const env = await setup();
    const { task } = await createTask(env.ctx, {
      title: 'Курс',
      type: 'chain',
      priority: 'low',
      tags: ['учёба'],
      due_date: '2026-10-10',
      estimate_minutes: 90,
      recurrence: presets.monthlyOnDay('2026-10-10', 10),
    });
    await addMilestone(env.ctx, task.id, 'Основы');
    await addMilestone(env.ctx, task.id, 'Практика');
    await createTask(env.ctx, { title: 'Записаться', parent_id: task.id });
    const payload = payloadFromTask(await get(env.db, task.id), {
      priorityKey: 'low',
      tags: (await env.db.tags.toArray()) as unknown as TagRow[],
      milestones: (await env.db.task_milestones.toArray()) as unknown as MilestoneRow[],
      subtasks: ((await env.db.tasks.toArray()) as unknown as TaskRow[]).filter((t) => t.parent_id === task.id),
    });
    expect(templatePayloadSchema.safeParse(JSON.parse(JSON.stringify(payload))).success).toBe(true);

    const { id } = await applyTemplate(env.ctx, payload, { due: null, projectId: null, today: '2026-09-29' });
    const created = await get(env.db, id);
    expect(created).toMatchObject({ title: 'Курс', type: 'chain', priority_id: 'p-low', estimate_minutes: 90 });
    // The repeat rule is re-anchored from today: the next 10th.
    expect(created.due_date).toBe('2026-10-10');
    expect(await env.db.task_milestones.where('task_id').equals(id).count()).toBe(2);
    expect(await env.db.tasks.where('parent_id').equals(id).count()).toBe(1);
    expect(await env.db.task_tags.where('task_id').equals(id).count()).toBe(1);
  });
});
