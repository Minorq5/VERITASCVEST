import { compareManual, compareTasks, type SectionTask } from './sections';

/** How a list is ordered. "manual" keeps the order people dragged. */
export const sortModes = ['manual', 'due', 'priority', 'created', 'title', 'progress'] as const;
export type SortMode = (typeof sortModes)[number];

export function isSortMode(value: unknown): value is SortMode {
  return typeof value === 'string' && (sortModes as readonly string[]).includes(value);
}

export interface SortTask extends SectionTask {
  title: string;
}

export interface SortContext {
  rankOf: (priorityId: string | null) => number;
  /** 0..1, or null when the type has no measurable progress. */
  progressOf: (task: SortTask) => number | null;
  locale: string;
}

/** A comparator for the mode; ties fall back to the deadline order, then manual. */
export function comparatorFor(mode: SortMode, ctx: SortContext): (a: SortTask, b: SortTask) => number {
  const deadline = (a: SortTask, b: SortTask) => compareTasks(a, b, ctx.rankOf);
  const collator = new Intl.Collator(ctx.locale, { sensitivity: 'base', numeric: true });
  switch (mode) {
    case 'manual':
      return compareManual;
    case 'due':
      return deadline;
    case 'priority':
      return (a, b) => ctx.rankOf(a.priority_id) - ctx.rankOf(b.priority_id) || deadline(a, b);
    case 'created':
      // Newest first: what was just written down is on top. Tasks sent in one
      // batch share the server's time; their ids (UUID v7) keep the order they were made in.
      return (a, b) =>
        (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
    case 'title':
      return (a, b) => collator.compare(a.title, b.title) || compareManual(a, b);
    case 'progress': {
      // Closest to done first; tasks without measurable progress go last.
      return (a, b) => {
        const pa = ctx.progressOf(a);
        const pb = ctx.progressOf(b);
        if (pa === null && pb === null) return deadline(a, b);
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pb - pa || deadline(a, b);
      };
    }
  }
}
