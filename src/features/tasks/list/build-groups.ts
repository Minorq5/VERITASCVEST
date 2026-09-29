import type { CompletionRow, TaskRow } from '@/lib/db/types';
import { matchesQuery, projectTrees, type QueryContext } from '@/lib/domain/filters';
import { inSection, isOverdue, type Section } from '@/lib/domain/sections';
import { comparatorFor, type SortMode } from '@/lib/domain/sort';
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
  /** Order of rows inside each group. */
  sort: SortMode;
  locale: string;
  dayTitle: (date: IsoDate) => string;
  overdueTitle: string;
}

/** What filters need to know about tasks beyond their own fields. */
export function queryContext(rc: RowContext): QueryContext {
  const sets = new Map<string, ReadonlySet<string>>();
  const none: ReadonlySet<string> = new Set();
  return {
    today: rc.today,
    now: rc.now,
    tagsOf: (taskId) => {
      let set = sets.get(taskId);
      if (!set) {
        const ids = rc.index.tags.get(taskId);
        set = ids ? new Set(ids) : none;
        sets.set(taskId, set);
      }
      return set;
    },
    projectTree: projectTrees(rc.catalog.allProjects),
  };
}

/** Where rows of a list can be dragged: the lists that keep a hand-made order. */
export function manualOrderAllowed(scope: NonNullable<ListScope>): boolean {
  return scope.kind === 'project' || (scope.kind === 'section' && scope.section === 'inbox');
}

/** The order a list has until someone picks another. */
export function defaultSort(scope: NonNullable<ListScope>): SortMode {
  return manualOrderAllowed(scope) ? 'manual' : 'due';
}

/** Splits the tasks of one list into the groups the screen shows. */
export function buildGroups(input: GroupInput): ListGroup[] {
  const { scope, rc, lingering } = input;
  const ctx = { today: rc.today, now: rc.now };
  const effective = (t: TaskRow) => lingering.get(t.id) ?? t;
  const deletedIds = new Set(input.tasks.filter((t) => t.deleted_at).map((t) => t.id));
  const row = (t: TaskRow) => buildRow(t, rc);
  const pick = (section: Section) => input.tasks.filter((t) => inSection(effective(t), section, ctx, deletedIds));

  // Rows are built first: sorting by progress reads what the rows computed.
  const sort = input.sort === 'manual' && !manualOrderAllowed(scope) ? 'due' : input.sort;
  const progress = new Map<string, number | null>();
  const compare = comparatorFor(sort, {
    rankOf: rc.catalog.rankOf,
    progressOf: (t) => progress.get(t.id) ?? null,
    locale: input.locale,
  });
  const sorted = (list: readonly TaskRow[]): RowModel[] => {
    const rows = list.map(row);
    for (const r of rows) progress.set(r.task.id, r.progress ? Math.min(r.progress.ratio, 1) : null);
    return rows.sort((a, b) => compare(effective(a.task), effective(b.task)));
  };
  const sortable = sort === 'manual';

  switch (scope.kind) {
    case 'project': {
      const tasks = input.tasks.filter((t) => {
        const e = effective(t);
        return e.project_id === scope.projectId && !e.parent_id && !e.deleted_at && !e.completed_at;
      });
      return [{ key: 'project', rows: sorted(tasks), sortable }];
    }

    case 'tag': {
      // Subtasks carry their own tags, so they are listed too.
      const tasks = input.tasks.filter((t) => {
        const e = effective(t);
        return !e.deleted_at && !e.completed_at && (rc.index.tags.get(t.id) ?? []).includes(scope.tagId);
      });
      return [{ key: 'tag', rows: sorted(tasks) }];
    }

    case 'smart': {
      // Like the date sections: a subtask shows up on its own only when it has its own deadline.
      const qctx = queryContext(rc);
      const tasks = input.tasks.filter((t) => {
        const e = effective(t);
        return (!e.parent_id || e.due_date !== null) && matchesQuery(e, scope.query, qctx);
      });
      return [{ key: 'smart', rows: sorted(tasks) }];
    }

    case 'section':
      break;
  }

  switch (scope.section) {
    case 'inbox':
      return [{ key: 'inbox', rows: sorted(pick('inbox')), sortable }];

    case 'today': {
      const due = pick('today');
      const overdue = due.filter((t) => (effective(t).due_date ?? '') < rc.today);
      const todays = due.filter((t) => effective(t).due_date === rc.today);
      const groups: ListGroup[] = [];
      if (overdue.length) groups.push({ key: 'overdue', title: input.overdueTitle, tone: 'danger', rows: sorted(overdue) });
      groups.push({ key: 'today', rows: sorted(todays), hideDate: true });
      return groups;
    }

    case 'tomorrow':
      return [{ key: 'tomorrow', rows: sorted(pick('tomorrow')), hideDate: true }];

    case 'week': {
      const tasks = pick('week');
      const groups: ListGroup[] = [];
      for (let i = 0; i < 7; i += 1) {
        const date = addDays(rc.today, i);
        const rows = sorted(tasks.filter((t) => effective(t).due_date === date));
        if (rows.length) groups.push({ key: date, title: input.dayTitle(date), date, rows, hideDate: true });
      }
      return groups;
    }

    case 'overdue':
      return [{ key: 'overdue', rows: sorted(input.tasks.filter((t) => isOverdue(effective(t), ctx))) }];

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
