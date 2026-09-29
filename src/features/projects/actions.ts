import type { ProjectRow, TaskRow } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { keyBetween } from '@/lib/order';
import type { Change } from '@/lib/sync/repo';
import type { ActionContext } from '@/features/tasks/data/actions';

export interface ProjectInput {
  name: string;
  color: string;
  parentId: string | null;
  description?: string;
  /** The planet's look; a random one when not given. */
  seed?: number;
}

const clean = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 120);

async function allProjects(ctx: ActionContext): Promise<ProjectRow[]> {
  return (await ctx.repo.db.projects.toArray()) as unknown as ProjectRow[];
}

/** A project and all its subprojects (alive ones), deepest last. */
export function subtreeOf(projects: readonly ProjectRow[], rootId: string): ProjectRow[] {
  const out: ProjectRow[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const p = projects.find((x) => x.id === id);
    if (p && !p.deleted_at) out.push(p);
    for (const child of projects) if (child.parent_id === id && !child.deleted_at) walk(child.id);
  };
  walk(rootId);
  return out;
}

export async function createProject(ctx: ActionContext, input: ProjectInput): Promise<{ id: string; inverse: Change[] }> {
  const projects = (await allProjects(ctx)).filter((p) => !p.deleted_at && p.parent_id === input.parentId);
  const last = projects.reduce<string | null>((max, p) => (max === null || p.sort_key > max ? p.sort_key : max), null);
  const id = newId();
  const { inverse } = await ctx.repo.insert('projects', {
    id,
    owner_id: ctx.userId,
    parent_id: input.parentId,
    name: clean(input.name),
    description: (input.description ?? '').trim().slice(0, 2000),
    color: input.color,
    icon: null,
    planet_seed: input.seed ?? Math.floor(Math.random() * 2_147_483_647),
    sort_key: keyBetween(last, null),
    archived_at: null,
    view_settings: {},
    deleted_at: null,
  } as never);
  return { id, inverse };
}

export async function updateProject(ctx: ActionContext, id: string, input: Partial<ProjectInput>): Promise<Change[]> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = clean(input.name);
  if (input.color !== undefined) patch.color = input.color;
  if (input.description !== undefined) patch.description = input.description.trim().slice(0, 2000);
  if (input.parentId !== undefined) {
    // Never under itself or one of its own subprojects.
    const tree = subtreeOf(await allProjects(ctx), id).map((p) => p.id);
    if (input.parentId === null || !tree.includes(input.parentId)) patch.parent_id = input.parentId;
  }
  const { inverse } = await ctx.repo.update('projects', id, patch as never);
  return inverse;
}

/** Archived projects leave the sidebar and their tasks leave the sections; nothing is deleted. */
export async function setArchived(ctx: ActionContext, id: string, archived: boolean): Promise<Change[]> {
  const { inverse } = await ctx.repo.update('projects', id, { archived_at: archived ? new Date().toISOString() : null } as never);
  return inverse;
}

/** Stores how the project is shown (view, sort) — on every device. */
export async function setViewSettings(ctx: ActionContext, project: ProjectRow, patch: Record<string, unknown>): Promise<Change[]> {
  const current = (project.view_settings && typeof project.view_settings === 'object' ? project.view_settings : {}) as Record<string, unknown>;
  const { inverse } = await ctx.repo.update('projects', project.id, { view_settings: { ...current, ...patch } } as never);
  return inverse;
}

/**
 * Deletes a project with its subprojects. Their tasks are kept: they move to
 * the inbox (with their subtasks), so nothing written down is lost.
 */
export async function deleteProject(ctx: ActionContext, id: string): Promise<{ inverse: Change[]; moved: number }> {
  const db = ctx.repo.db;
  const tree = subtreeOf(await allProjects(ctx), id);
  const ids = new Set(tree.map((p) => p.id));
  const tasks = ((await db.tasks.toArray()) as unknown as TaskRow[]).filter((t) => t.project_id && ids.has(t.project_id));
  const inverse: Change[] = [];
  for (const task of tasks) {
    const { inverse: inv } = await ctx.repo.update('tasks', task.id, { project_id: null } as never);
    inverse.unshift(...inv);
  }
  const now = new Date().toISOString();
  for (const project of [...tree].reverse()) {
    const { inverse: inv } = await ctx.repo.update('projects', project.id, { deleted_at: now } as never);
    inverse.unshift(...inv);
  }
  return { inverse, moved: tasks.filter((t) => !t.parent_id && !t.deleted_at).length };
}
