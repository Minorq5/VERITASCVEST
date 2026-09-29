import type { ActionContext } from '@/features/tasks/data/actions';
import { swatchFor } from '@/lib/color/swatches';
import type { TagRow } from '@/lib/db/types';
import { newId, stableId } from '@/lib/ids';
import type { Change } from '@/lib/sync/repo';

/** A tag is one word (the smart line reads "#word"): spaces inside become hyphens. */
export function cleanTagName(name: string): string {
  return name.trim().replace(/^#+/, '').trim().replace(/\s+/g, '-').slice(0, 40);
}

/** Another living tag with this name (names are compared without case). */
export async function tagNamed(ctx: ActionContext, name: string, exceptId?: string): Promise<TagRow | null> {
  const wanted = cleanTagName(name).toLocaleLowerCase();
  const rows = (await ctx.repo.db.tags.toArray()) as unknown as TagRow[];
  return rows.find((t) => !t.deleted_at && t.id !== exceptId && t.name.toLocaleLowerCase() === wanted) ?? null;
}

export async function createTag(ctx: ActionContext, name: string, color?: string): Promise<{ id: string; inverse: Change[] }> {
  const clean = cleanTagName(name);
  // The same id the smart line would give this name, so two devices meet in one tag.
  let id = stableId.tag(ctx.userId, clean);
  if (await ctx.repo.db.tags.get(id)) id = newId();
  const { inverse } = await ctx.repo.insert('tags', { id, owner_id: ctx.userId, name: clean, color: color ?? swatchFor(clean), deleted_at: null } as never);
  return { id, inverse };
}

export async function updateTag(ctx: ActionContext, id: string, patch: { name?: string; color?: string }): Promise<Change[]> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = cleanTagName(patch.name);
  if (patch.color !== undefined) data.color = patch.color;
  const { inverse } = await ctx.repo.update('tags', id, data as never);
  return inverse;
}

/** Deletes a tag: it leaves every task that had it; the tasks themselves stay. */
export async function deleteTag(ctx: ActionContext, id: string): Promise<{ inverse: Change[]; tasks: number }> {
  const db = ctx.repo.db;
  const now = (ctx.now?.() ?? new Date()).toISOString();
  const links = (await db.task_tags.where('tag_id').equals(id).toArray()).filter((l) => !l.deleted_at);
  const inverse: Change[] = [];
  for (const link of links) inverse.unshift(...(await ctx.repo.update('task_tags', String(link.id), { deleted_at: now } as never)).inverse);
  inverse.unshift(...(await ctx.repo.update('tags', id, { deleted_at: now } as never)).inverse);
  return { inverse, tasks: links.length };
}
