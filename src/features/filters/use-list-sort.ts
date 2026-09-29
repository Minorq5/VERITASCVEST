'use client';

import { setViewSettings } from '@/features/projects/actions';
import { useCatalog } from '@/features/tasks/data/hooks';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { defaultSort, manualOrderAllowed } from '@/features/tasks/list/build-groups';
import { scopeKey, type ListScope } from '@/features/tasks/quick-add/store';
import { isSortMode, sortModes, type SortMode } from '@/lib/domain/sort';
import { useListViews } from '@/stores/list-views';
import { updateSmartList } from './actions';

export interface ListSort {
  mode: SortMode;
  /** The orders this list offers ("manual" only where rows can be dragged). */
  modes: readonly SortMode[];
  setMode: (mode: SortMode) => void;
}

/**
 * The order of a list and where it is kept: a project's and a smart list's
 * order live in the account (every device), the sections' and tags' on this
 * device. "Completed" and "Trash" keep their own fixed order.
 */
export function useListSort(scope: NonNullable<ListScope>): ListSort | null {
  const catalog = useCatalog();
  const actions = useTaskActions();
  const key = scopeKey(scope);
  const onDevice = useListViews((s) => s.sort[key]);
  const setOnDevice = useListViews((s) => s.setSort);

  if (scope.kind === 'section' && (scope.section === 'completed' || scope.section === 'trash')) return null;
  const modes = sortModes.filter((m) => m !== 'manual' || manualOrderAllowed(scope));
  const valid = (mode: unknown): SortMode | null => (isSortMode(mode) && modes.includes(mode) ? mode : null);
  const fallback = defaultSort(scope);

  if (scope.kind === 'project') {
    const project = catalog?.projectById.get(scope.projectId);
    const settings = (project?.view_settings ?? {}) as Record<string, unknown>;
    return {
      mode: valid(settings.sort) ?? fallback,
      modes,
      setMode: (mode) => {
        if (project) void setViewSettings(actions.ctx, project, { sort: mode });
      },
    };
  }
  if (scope.kind === 'smart' && scope.listId) {
    const list = catalog?.savedFilterById.get(scope.listId);
    const id = scope.listId;
    return {
      mode: valid(list?.sort) ?? fallback,
      modes,
      setMode: (mode) => void updateSmartList(actions.ctx, id, { sort: mode }),
    };
  }
  return { mode: valid(onDevice) ?? fallback, modes, setMode: (mode) => setOnDevice(key, mode) };
}
