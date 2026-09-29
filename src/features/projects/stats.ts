import type { ProjectRow } from '@/lib/db/types';
import { isOverdue, type SectionContext, type SectionTask } from '@/lib/domain/sections';

export interface ProjectStats {
  open: number;
  overdue: number;
  done: number;
  /** done / (open + done), 0 when empty. */
  ratio: number;
}

const empty = (): ProjectStats => ({ open: 0, overdue: 0, done: 0, ratio: 0 });

/**
 * Task counts of every project, each including its subprojects. Only
 * top-level tasks count (subtasks belong to their task).
 */
export function projectStats(
  tasks: readonly SectionTask[],
  projects: readonly Pick<ProjectRow, 'id' | 'parent_id' | 'deleted_at'>[],
  ctx: SectionContext,
): Map<string, ProjectStats> {
  const own = new Map<string, ProjectStats>();
  for (const t of tasks) {
    if (!t.project_id || t.parent_id || t.deleted_at) continue;
    const s = own.get(t.project_id) ?? empty();
    if (t.completed_at) s.done += 1;
    else {
      s.open += 1;
      if (isOverdue(t, ctx)) s.overdue += 1;
    }
    own.set(t.project_id, s);
  }
  const children = new Map<string, string[]>();
  for (const p of projects) {
    if (!p.parent_id || p.deleted_at) continue;
    children.set(p.parent_id, [...(children.get(p.parent_id) ?? []), p.id]);
  }
  const total = new Map<string, ProjectStats>();
  const sum = (id: string, seen: Set<string>): ProjectStats => {
    const cached = total.get(id);
    if (cached) return cached;
    const s = { ...(own.get(id) ?? empty()) };
    seen.add(id);
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue;
      const c = sum(child, seen);
      s.open += c.open;
      s.overdue += c.overdue;
      s.done += c.done;
    }
    s.ratio = s.open + s.done > 0 ? s.done / (s.open + s.done) : 0;
    total.set(id, s);
    return s;
  };
  for (const p of projects) if (!p.deleted_at) sum(p.id, new Set());
  return total;
}

/** The chain from the top project down to this one. */
export function projectPath<T extends { id: string; parent_id: string | null }>(byId: ReadonlyMap<string, T>, id: string): T[] {
  const path: T[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(id);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
  return path;
}

export interface ProjectNode<T> {
  project: T;
  children: ProjectNode<T>[];
  depth: number;
}

/** Projects as a tree (in the given order); orphans whose parent is gone become roots. */
export function projectForest<T extends { id: string; parent_id: string | null }>(projects: readonly T[]): ProjectNode<T>[] {
  const ids = new Set(projects.map((p) => p.id));
  const build = (parent: string | null, depth: number, seen: Set<string>): ProjectNode<T>[] =>
    projects
      .filter((p) => (parent === null ? !p.parent_id || !ids.has(p.parent_id) : p.parent_id === parent) && !seen.has(p.id))
      .map((p) => {
        const next = new Set(seen).add(p.id);
        return { project: p, depth, children: build(p.id, depth + 1, next) };
      });
  return build(null, 0, new Set());
}
