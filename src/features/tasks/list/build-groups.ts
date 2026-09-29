import type { CompletionRow, TaskRow } from '@/lib/db/types';
import { compareManual, compareTasks, inSection, isOverdue, type Section } from '@/lib/domain/sections';
import { addDays, todayIn, type IsoDate } from '@/lib/time/dates';
import type { ListScope } from '../quick-add/store';
import { buildRow, type RowContext, type RowModel } from './row-model';

export interface ListGroup {
  key: string;
  /** Group header; none for a single plain list. */
  title?: string;
  tone?: 'danger';
  /** The day of a dated group (for "move all to today" and headers). */
  date?: IsoDate;
  rows: RowModel[];
  hideDate?: boolean;
  sortable?: boolean;
}

export interface GroupInput {
  scope: NonNullable<ListScope>;
  tasks: readonly TaskRow[];
  completions: readonly CompletionRow[];
  /** Rows just completed, as they were before (they keep their place for a moment). */
  lingering: ReadonlyMap<string, TaskRow>;
  rc: RowContext;
  dayTitle: (date: IsoDate) => string;
  overdueTitle: string;
}

/** Splits the tasks of one list into the groups the screen shows. */
export function buildGroups(input: GroupInput): ListGroup[] {
  const { scope, rc, lingering } = input;
  const ctx = { today: rc.today, now: rc.now };
  const effective = (t: TaskRow) => lingering.get(t.id) ?? t;
  const rank = rc.catalog.rankOf;
  const byDeadline = (a: TaskRow, b: TaskRow) => compareTasks(effective(a), effective(b), rank);
  const byManual = (a: TaskRow, b: TaskRow) => compareManual(effective(a), effective(b));
  const deletedIds = new Set(input.tasks.filter((t) => t.deleted_at).map((t) => t.id));
  const row = (t: TaskRow) => buildRow(t, rc);
  const pick = (section: Section) => input.tasks.filter((t) => inSection(effective(t), section, ctx, deletedIds));

  if (scope.kind === 'project') {
    const rows = input.tasks
      .filter((t) => {
        const e = effective(t);
        return e.project_id === scope.projectId && !e.parent_id && !e.deleted_at && !e.completed_at;
      })
      .sort(byManual)
      .map(row);
    return [{ key: 'project', rows, sortable: true }];
  }

  switch (scope.section) {
    case 'inbox':
      return [{ key: 'inbox', rows: pick('inbox').sort(byManual).map(row), sortable: true }];

    case 'today': {
      const due = pick('today');
      const overdue = due.filter((t) => (effective(t).due_date ?? '') < rc.today).sort(byDeadline);
      const todays = due.filter((t) => effective(t).due_date === rc.today).sort(byDeadline);
      const groups: ListGroup[] = [];
      if (overdue.length) groups.push({ key: 'overdue', title: input.overdueTitle, tone: 'danger', rows: overdue.map(row) });
      groups.push({ key: 'today', rows: todays.map(row), hideDate: true });
      return groups;
    }

    case 'tomorrow':
      return [{ key: 'tomorrow', rows: pick('tomorrow').sort(byDeadline).map(row), hideDate: true }];

    case 'week': {
      const tasks = pick('week');
      const groups: ListGroup[] = [];
      for (let i = 0; i < 7; i += 1) {
        const date = addDays(rc.today, i);
        const rows = tasks.filter((t) => effective(t).due_date === date).sort(byDeadline).map(row);
        if (rows.length) groups.push({ key: date, title: input.dayTitle(date), date, rows, hideDate: true });
      }
      return groups;
    }

    case 'overdue':
      return [{ key: 'overdue', rows: input.tasks.filter((t) => isOverdue(effective(t), ctx)).sort(byDeadline).map(row) }];

    case 'completed': {
      // Closed tasks, plus each completed occurrence of repeating tasks.
      const entries: { at: string; model: RowModel }[] = [];
      for (const t of input.tasks) {
        if (t.deleted_at || !t.completed_at) continue;
        entries.push({ at: t.completed_at, model: row(t) });
      }
      const byId = rc.tasksById;
      for (const c of input.completions) {
        if (c.occurrence_date == null) continue;
        const task = byId.get(c.task_id);
        if (!task || task.deleted_at) continue;
        entries.push({ at: c.completed_at, model: { ...row(task), key: `c-${c.id}` } });
      }
      entries.sort((a, b) => b.at.localeCompare(a.at));
      const groups = new Map<IsoDate, RowModel[]>();
      for (const e of entries.slice(0, 400)) {
        const date = todayIn(rc.timeZone, new Date(e.at));
        const list = groups.get(date);
        const model = { ...e.model, completedAt: e.at };
        if (list) list.push(model);
        else groups.set(date, [model]);
      }
      return [...groups.entries()].map(([date, rows]) => ({ key: date, title: input.dayTitle(date), date, rows, hideDate: false }));
    }

    case 'trash':
      return [
        {
          key: 'trash',
          rows: pick('trash')
            .sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)))
            .map(row),
        },
      ];
  }
}
