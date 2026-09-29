'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useSync } from '@/features/sync/sync-provider';
import type { TaskRow } from '@/lib/db/types';
import type { Change, Repo } from '@/lib/sync/repo';
import type { IsoDate } from '@/lib/time/dates';
import { completeSound, sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { useUndo } from '@/stores/undo';
import {
  addProgressEvent,
  completeTask,
  createTask,
  duplicateTask,
  purgeTask,
  reopenTask,
  restoreTask,
  setTaskTags,
  systemPriority,
  trashTask,
  updateTask,
  type ActionContext,
  type NewTask,
} from './actions';
import { removeAttachmentFiles } from './attachment-files';
import { usePlannerPrefs } from './hooks';
import { useLingering } from './lingering';

/** Pending "is the parent done now?" checks, one queue per parent task. */
const parentChecks = new Map<string, Promise<void>>();

/** Undo the newest action (or a specific one, from its toast). */
export async function undoAction(repo: Repo, id?: number): Promise<string | null> {
  const entry = useUndo.getState().takePast(id);
  if (!entry) return null;
  const redo = await repo.apply(entry.changes);
  useUndo.getState().pushFuture({ label: entry.label, changes: redo });
  return entry.label;
}

export async function redoAction(repo: Repo): Promise<string | null> {
  const entry = useUndo.getState().takeFuture();
  if (!entry) return null;
  const undo = await repo.apply(entry.changes);
  useUndo.getState().pushPast({ label: entry.label, changes: undo });
  return entry.label;
}

/**
 * Everything the interface does with tasks. Each action changes the device
 * copy at once, lands in the undo history and, where it matters, shows a
 * toast with "Undo".
 */
export function useTaskActions() {
  const { repo, userId } = useSync();
  const prefs = usePlannerPrefs();
  const t = useTranslations('tasks');
  const tc = useTranslations('common');

  return useMemo(() => {
    const ctx: ActionContext = { repo, userId, timeZone: prefs.timeZone, weekStart: prefs.weekStart };

    /** Records the action; with a title, also offers "Undo" in a toast. */
    const remember = (label: string, changes: Change[], title?: string, description?: string) => {
      const id = useUndo.getState().record(label, changes);
      if (id !== null && title) {
        toast.undo(title, tc('undo'), () => {
          sound.play('undo');
          void undoAction(repo, id).then((l) => l && toast.info(t('toast.undone')));
        }, {
          id: `undo-${id}`,
          description,
        });
      }
      return id;
    };

    const fail = (error: unknown) => {
      console.error(error);
      toast.error(t('toast.failed'));
    };

    const run = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (error) {
        fail(error);
        return undefined;
      }
    };

    /**
     * A "by subtasks" task is done when its last open subtask is done. Checks
     * for one parent run one after another, so two subtasks ticked at once
     * complete it once.
     */
    const completeParentIfDone = (parentId: string) => {
      const check = async () => {
        const parent = (await repo.db.tasks.get(parentId)) as TaskRow | undefined;
        if (!parent || parent.type !== 'subtasks' || parent.completed_at || parent.deleted_at) return;
        const children = ((await repo.db.tasks.where('parent_id').equals(parentId).toArray()) as TaskRow[]).filter((c) => !c.deleted_at);
        if (children.length > 0 && children.every((c) => c.completed_at)) await actions.complete(parent, { auto: true });
      };
      const next = (parentChecks.get(parentId) ?? Promise.resolve()).then(check);
      const settled = next.catch(() => undefined);
      parentChecks.set(parentId, settled);
      void settled.then(() => {
        if (parentChecks.get(parentId) === settled) parentChecks.delete(parentId);
      });
      return next;
    };

    const actions = {
      ctx,

      create: (input: NewTask) =>
        run(async () => {
          const { task, inverse } = await createTask(ctx, input);
          sound.play('taskCreate');
          remember(t('toast.created'), inverse);
          return task;
        }),

      update: (id: string, patch: Partial<TaskRow>, label = t('toast.changed')) =>
        run(async () => {
          const inverse = await updateTask(ctx, id, patch);
          remember(label, inverse);
          return inverse;
        }),

      complete: (task: TaskRow, options: { auto?: boolean; nextLabel?: (date: IsoDate) => string } = {}) =>
        run(async () => {
          useLingering.getState().add(task);
          // The deeper the priority, the richer the sound; a subtask is a short high pluck.
          const priority = task.priority_id ? await repo.db.priorities.get(task.priority_id) : undefined;
          sound.play(task.parent_id ? 'subtaskComplete' : completeSound(priority?.system_key as string | undefined));
          const outcome = await completeTask(ctx, task);
          const title = options.auto
            ? t('toast.autoCompleted')
            : outcome.nextDue && options.nextLabel
              ? t('toast.completedNext', { date: options.nextLabel(outcome.nextDue) })
              : t('toast.completed');
          remember(t('toast.completed'), outcome.inverse, title);
          if (task.parent_id) await completeParentIfDone(task.parent_id);
          return outcome;
        }),

      reopen: (task: TaskRow) =>
        run(async () => {
          const inverse = await reopenTask(ctx, task);
          sound.play('undo');
          remember(t('toast.reopened'), inverse, t('toast.reopened'));
        }),

      toggle: (task: TaskRow, nextLabel?: (date: IsoDate) => string) =>
        task.completed_at ? actions.reopen(task) : actions.complete(task, { nextLabel }),

      trash: (ids: readonly string[]) =>
        run(async () => {
          const inverse: Change[] = [];
          for (const id of ids) inverse.unshift(...(await trashTask(ctx, id)));
          sound.play('trash');
          const title = ids.length === 1 ? t('toast.deleted') : t('toast.deletedMany', { count: ids.length });
          remember(title, inverse, title);
        }),

      restore: (ids: readonly string[]) =>
        run(async () => {
          const inverse: Change[] = [];
          for (const id of ids) inverse.unshift(...(await restoreTask(ctx, id)));
          sound.play('undo');
          const title = ids.length === 1 ? t('toast.restored') : t('toast.restoredMany', { count: ids.length });
          remember(title, inverse, title);
        }),

      /** Permanent: no undo (the person confirmed it). */
      purge: (ids: readonly string[]) =>
        run(async () => {
          await removeAttachmentFiles(repo.db, ids);
          for (const id of ids) await purgeTask(ctx, id);
          sound.play('trash');
          toast.success(t('toast.purged'));
        }),

      emptyTrash: (ids: readonly string[]) =>
        run(async () => {
          await removeAttachmentFiles(repo.db, ids);
          for (const id of ids) await purgeTask(ctx, id);
          sound.play('trash');
          toast.success(t('toast.trashEmptied'));
        }),

      setDue: (ids: readonly string[], date: IsoDate | null, label: string) =>
        run(async () => {
          const inverse: Change[] = [];
          for (const id of ids) inverse.unshift(...(await updateTask(ctx, id, { due_date: date } as Partial<TaskRow>)));
          const title = ids.length === 1 ? t('toast.moved', { date: label }) : t('toast.movedMany', { count: ids.length });
          remember(title, inverse, title);
        }),

      setPriority: (ids: readonly string[], key: string | null) =>
        run(async () => {
          const priority = await systemPriority(repo.db, key);
          const inverse: Change[] = [];
          for (const id of ids) {
            inverse.unshift(...(await updateTask(ctx, id, { priority_id: (priority?.id as string | undefined) ?? null } as Partial<TaskRow>)));
          }
          remember(t('toast.changed'), inverse, ids.length > 1 ? t('toast.changed') : undefined);
        }),

      completeMany: (tasks: readonly TaskRow[]) =>
        run(async () => {
          const inverse: Change[] = [];
          for (const task of tasks) {
            if (task.completed_at || task.deleted_at) continue;
            useLingering.getState().add(task);
            inverse.unshift(...(await completeTask(ctx, task)).inverse);
          }
          sound.play('completeHigh');
          const title = t('toast.completedMany', { count: tasks.length });
          remember(title, inverse, title);
        }),

      setTags: (id: string, names: readonly string[]) =>
        run(async () => {
          const inverse = await setTaskTags(ctx, id, names);
          remember(t('toast.changed'), inverse);
        }),

      duplicate: (id: string) =>
        run(async () => {
          const result = await duplicateTask(ctx, id, t('actions.duplicateSuffix'));
          remember(t('toast.duplicated'), result.inverse, t('toast.duplicated'));
          return result.id;
        }),

      /** A progress event (counter +1, numeric "add", a contribution, a relapse). */
      addEvent: (taskId: string, kind: 'set' | 'delta' | 'contribution' | 'relapse', value: number, note?: string) =>
        run(async () => {
          const inverse = await addProgressEvent(ctx, taskId, kind, value, note);
          remember(t('toast.changed'), inverse);
          return inverse;
        }),

      /** Several small writes made by a widget, as one undo step. */
      record: (label: string, changes: Change[], toastTitle?: string) => remember(label, changes, toastTitle),

      undo: async () => {
        const label = await undoAction(repo);
        if (label) sound.play('undo');
        if (label) toast.info(t('toast.undone'), { id: 'undo-result', description: label });
        else toast.info(t('toast.nothingToUndo'), { id: 'undo-result' });
      },

      redo: async () => {
        const label = await redoAction(repo);
        if (label) toast.info(t('toast.redone'), { id: 'undo-result', description: label });
        else toast.info(t('toast.nothingToRedo'), { id: 'undo-result' });
      },
    };
    return actions;
  }, [repo, userId, prefs.timeZone, prefs.weekStart, t, tc]);
}

export type TaskActions = ReturnType<typeof useTaskActions>;
