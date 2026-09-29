import type { ActionContext } from '@/features/tasks/data/actions';
import type { SavedFilterRow } from '@/lib/db/types';
import { sanitizeQuery, type TaskQuery } from '@/lib/domain/filters';
import type { SortMode } from '@/lib/domain/sort';
import { newId } from '@/lib/ids';
import { keyBetween } from '@/lib/order';
import type { Change } from '@/lib/sync/repo';

export interface SmartListInput {
  name: string;
  color: string;
  query: TaskQuery;
  sort: SortMode;
}

const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 60);

/** A new smart list, at the end of the sidebar. */
export async function createSmartList(ctx: ActionContext, input: SmartListInput): Promise<{ id: string; inverse: Change[] }> {
  const rows = ((await ctx.repo.db.saved_filters.toArray()) as unknown as SavedFilterRow[]).filter((r) => !r.deleted_at);
  const last = rows.reduce<string | null>((max, r) => (max === null || r.sort_key > max ? r.sort_key : max), null);
  const id = newId();
  const { inverse } = await ctx.repo.insert('saved_filters', {
    id,
    owner_id: ctx.userId,
    name: cleanName(input.name),
    icon: null,
    color: input.color,
    query: sanitizeQuery(input.query),
    sort: input.sort,
    view: 'list',
    pinned: true,
    sort_key: keyBetween(last, null),
    deleted_at: null,
  } as never);
  return { id, inverse };
}

export async function updateSmartList(
  ctx: ActionContext,
  id: string,
  patch: Partial<{ name: string; color: string; query: TaskQuery; sort: SortMode }>,
): Promise<Change[]> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = cleanName(patch.name);
  if (patch.color !== undefined) data.color = patch.color;
  if (patch.query !== undefined) data.query = sanitizeQuery(patch.query);
  if (patch.sort !== undefined) data.sort = patch.sort;
  const { inverse } = await ctx.repo.update('saved_filters', id, data as never);
  return inverse;
}

/** Deletes the list only: the tasks it showed stay where they are. */
export async function deleteSmartList(ctx: ActionContext, id: string): Promise<Change[]> {
  const { inverse } = await ctx.repo.update('saved_filters', id, { deleted_at: (ctx.now?.() ?? new Date()).toISOString() } as never);
  return inverse;
}
