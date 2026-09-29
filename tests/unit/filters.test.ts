import { describe, expect, it } from 'vitest';
import { activeParts, matchesQuery, projectTrees, sanitizeQuery, type QueryContext, type QueryTask } from '@/lib/domain/filters';
import { comparatorFor, type SortTask } from '@/lib/domain/sort';

const today = '2026-09-30';
const now = new Date('2026-09-30T12:00:00+03:00');

function task(over: Partial<QueryTask & SortTask> & { id: string }): QueryTask & SortTask {
  return {
    parent_id: null,
    project_id: null,
    due_date: null,
    due_time: null,
    timezone: 'Europe/Moscow',
    completed_at: null,
    deleted_at: null,
    priority_id: null,
    sort_key: 'a0',
    created_at: '2026-09-01T10:00:00Z',
    type: 'normal',
    status_id: null,
    title: over.id,
    ...over,
  };
}

const tags: Record<string, string[]> = { t1: ['sport'], t2: ['sport', 'health'], t3: [] };
const projects = [
  { id: 'home', parent_id: null },
  { id: 'garden', parent_id: 'home' },
  { id: 'beds', parent_id: 'garden' },
  { id: 'work', parent_id: null },
];
const ctx: QueryContext = {
  today,
  now,
  tagsOf: (id) => new Set(tags[id] ?? []),
  projectTree: projectTrees(projects),
};
const match = (t: QueryTask, q: Parameters<typeof matchesQuery>[1]) => matchesQuery(t, q, ctx);

describe('matchesQuery', () => {
  it('open tasks by default; done and all on request; never the trash', () => {
    const open = task({ id: 'open' });
    const done = task({ id: 'done', completed_at: '2026-09-29T10:00:00Z' });
    const trashed = task({ id: 'trashed', deleted_at: '2026-09-29T10:00:00Z' });
    expect([open, done, trashed].filter((t) => match(t, {})).map((t) => t.id)).toEqual(['open']);
    expect([open, done, trashed].filter((t) => match(t, { state: 'done' })).map((t) => t.id)).toEqual(['done']);
    expect([open, done, trashed].filter((t) => match(t, { state: 'all' })).map((t) => t.id)).toEqual(['open', 'done']);
  });

  it('due ranges: overdue, today, tomorrow, week, month, later, none', () => {
    const list = [
      task({ id: 'yesterday', due_date: '2026-09-29' }),
      task({ id: 'today-past', due_date: today, due_time: '09:00' }),
      task({ id: 'today', due_date: today }),
      task({ id: 'tomorrow', due_date: '2026-10-01' }),
      task({ id: 'in5', due_date: '2026-10-05' }),
      task({ id: 'in20', due_date: '2026-10-20' }),
      task({ id: 'in60', due_date: '2026-11-29' }),
      task({ id: 'none' }),
    ];
    const pick = (due: NonNullable<Parameters<typeof match>[1]['due']>) => list.filter((t) => match(t, { due })).map((t) => t.id);
    expect(pick(['overdue'])).toEqual(['yesterday', 'today-past']);
    expect(pick(['today'])).toEqual(['today-past', 'today']);
    expect(pick(['tomorrow'])).toEqual(['tomorrow']);
    expect(pick(['week'])).toEqual(['today-past', 'today', 'tomorrow', 'in5']);
    expect(pick(['month'])).toEqual(['today-past', 'today', 'tomorrow', 'in5', 'in20']);
    expect(pick(['later'])).toEqual(['in60']);
    expect(pick(['none'])).toEqual(['none']);
    expect(pick(['overdue', 'tomorrow'])).toEqual(['yesterday', 'today-past', 'tomorrow']);
  });

  it('priorities, statuses and types; "none" means without a priority', () => {
    const a = task({ id: 'a', priority_id: 'high', status_id: 'doing', type: 'numeric' });
    const b = task({ id: 'b' });
    expect(match(a, { priorities: ['high', 'critical'] })).toBe(true);
    expect(match(b, { priorities: ['high'] })).toBe(false);
    expect(match(b, { priorities: ['none'] })).toBe(true);
    expect(match(a, { statuses: ['doing'] })).toBe(true);
    expect(match(b, { statuses: ['doing'] })).toBe(false);
    expect(match(a, { types: ['numeric', 'habit'] })).toBe(true);
    expect(match(a, { types: ['habit'] })).toBe(false);
  });

  it('a project includes its subprojects at any depth; "none" is outside projects', () => {
    const inBeds = task({ id: 'x', project_id: 'beds' });
    const inWork = task({ id: 'y', project_id: 'work' });
    const loose = task({ id: 'z' });
    expect(match(inBeds, { projects: ['home'] })).toBe(true);
    expect(match(inWork, { projects: ['home'] })).toBe(false);
    expect(match(loose, { projects: ['none'] })).toBe(true);
    expect(match(inWork, { projects: ['none', 'work'] })).toBe(true);
  });

  it('tags: any of them, or all of them', () => {
    expect(match(task({ id: 't1' }), { tags: ['sport', 'health'] })).toBe(true);
    expect(match(task({ id: 't1' }), { tags: ['sport', 'health'], tagMode: 'all' })).toBe(false);
    expect(match(task({ id: 't2' }), { tags: ['sport', 'health'], tagMode: 'all' })).toBe(true);
    expect(match(task({ id: 't3' }), { tags: ['sport'] })).toBe(false);
  });

  it('parts combine: every part must hold', () => {
    const t = task({ id: 't2', project_id: 'garden', priority_id: 'high', due_date: today });
    expect(match(t, { projects: ['home'], tags: ['health'], priorities: ['high'], due: ['today'] })).toBe(true);
    expect(match(t, { projects: ['home'], tags: ['health'], priorities: ['low'] })).toBe(false);
  });
});

describe('sanitizeQuery and activeParts', () => {
  it('keeps only known parts and values', () => {
    expect(
      sanitizeQuery({ state: 'done', due: ['today', 'someday', 5], types: ['habit', 'weird'], tags: ['a', 'a', ''], tagMode: 'all', extra: 1 }),
    ).toEqual({ state: 'done', due: ['today'], types: ['habit'], tags: ['a'], tagMode: 'all' });
    expect(sanitizeQuery(null)).toEqual({});
    expect(sanitizeQuery([1, 2])).toEqual({});
    expect(sanitizeQuery({ state: 'maybe', due: 'today' })).toEqual({});
  });

  it('counts the parts that narrow the list', () => {
    expect(activeParts({})).toBe(0);
    expect(activeParts({ state: 'open', due: [], tags: ['x'] })).toBe(1);
    expect(activeParts({ state: 'all', due: ['today'], projects: ['p'], tags: ['x'] })).toBe(4);
  });
});

describe('comparatorFor', () => {
  const rankOf = (id: string | null) => ({ critical: 1, high: 2, medium: 3, low: 4 })[id ?? ''] ?? 5;
  const progress: Record<string, number | null> = { a: 0.2, b: 0.9, c: null };
  const sortCtx = { rankOf, progressOf: (t: SortTask) => progress[t.id] ?? null, locale: 'ru' };
  const a = task({ id: 'a', title: 'Бета', priority_id: 'low', due_date: '2026-10-03', created_at: '2026-09-02T00:00:00Z', sort_key: 'a2' });
  const b = task({ id: 'b', title: 'альфа', priority_id: 'critical', due_date: '2026-10-05', created_at: '2026-09-03T00:00:00Z', sort_key: 'a1' });
  const c = task({ id: 'c', title: 'Гамма 10', due_date: null, created_at: '2026-09-01T00:00:00Z', sort_key: 'a0' });
  const order = (mode: Parameters<typeof comparatorFor>[0]) => [a, b, c].sort(comparatorFor(mode, sortCtx)).map((t) => t.id);

  it('orders by each mode', () => {
    expect(order('manual')).toEqual(['c', 'b', 'a']);
    expect(order('due')).toEqual(['a', 'b', 'c']);
    expect(order('priority')).toEqual(['b', 'a', 'c']);
    expect(order('created')).toEqual(['b', 'a', 'c']);
    expect(order('title')).toEqual(['b', 'a', 'c']);
    expect(order('progress')).toEqual(['b', 'a', 'c']);
  });

  it('newest first even when the server gave a batch one time: ids are time-ordered', () => {
    const at = '2026-09-05T10:00:00Z';
    const older = task({ id: '01990000-0000-7000-8000-000000000001', created_at: at, sort_key: 'a0' });
    const newer = task({ id: '01990000-0001-7000-8000-000000000001', created_at: at, sort_key: 'a1' });
    expect([older, newer].sort(comparatorFor('created', sortCtx)).map((t) => t.id)).toEqual([newer.id, older.id]);
  });

  it('titles compare naturally: 2 before 10', () => {
    const x = task({ id: 'x', title: 'Глава 10' });
    const y = task({ id: 'y', title: 'Глава 2' });
    expect([x, y].sort(comparatorFor('title', sortCtx)).map((t) => t.id)).toEqual(['y', 'x']);
  });
});
