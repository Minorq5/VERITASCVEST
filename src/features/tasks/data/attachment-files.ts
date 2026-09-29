'use client';

import type { VeritasDB } from '@/lib/db/schema';
import type { AttachmentRow, TaskRow } from '@/lib/db/types';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Files attached to a task and to all its subtasks are removed from storage
 * before the task is deleted for good: the rows disappear with the task, and
 * nothing would point at the files any more. Best effort: without network the
 * files stay (a server sweep cleans such leftovers).
 */
export async function removeAttachmentFiles(db: VeritasDB, taskIds: readonly string[]): Promise<void> {
  const all = new Set<string>();
  const queue = [...taskIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (all.has(id)) continue;
    all.add(id);
    const children = (await db.tasks.where('parent_id').equals(id).toArray()) as unknown as TaskRow[];
    for (const child of children) queue.push(child.id);
  }
  const rows = (await db.attachments.where('task_id').anyOf([...all]).toArray()) as unknown as AttachmentRow[];
  const paths = rows.flatMap((row) => [row.storage_path, row.thumb_path]).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  try {
    for (let i = 0; i < paths.length; i += 500) {
      await getSupabase().storage.from('attachments').remove(paths.slice(i, i + 500));
    }
  } catch {
    // Offline or refused: the files outlive the task until the server sweep.
  }
}
