'use client';

import { Ellipsis, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useCatalog } from '@/features/tasks/data/hooks';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { TaskListView } from '@/features/tasks/list/list-view';
import { useRouter } from '@/i18n/navigation';
import type { SavedFilterRow } from '@/lib/db/types';
import { activeParts, sanitizeQuery, type TaskQuery } from '@/lib/domain/filters';
import { sound } from '@/sound/engine';
import { useListViews } from '@/stores/list-views';
import { toast } from '@/stores/toasts';
import { deleteSmartList, updateSmartList } from './actions';
import { FilterBar } from './filter-bar';
import { SmartListDialog } from './smart-list-dialog';
import { SmartListMark } from './smart-list-mark';

function SmartListMenu({ list }: { list: SavedFilterRow }) {
  const t = useTranslations('lists');
  const tc = useTranslations('common');
  const actions = useTaskActions();
  const router = useRouter();
  const [open, setOpen] = useState<null | 'edit' | 'delete'>(null);

  const remove = async () => {
    const inverse = await deleteSmartList(actions.ctx, list.id);
    actions.record(t('toast.deleted'), inverse, t('toast.deleted'));
    sound.play('trash');
    setOpen(null);
    router.replace('/today');
  };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={t('actions.more')} icon={<Ellipsis />} />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem icon={<Pencil />} onSelect={() => setOpen('edit')}>
            {t('actions.edit')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setOpen('delete')}>
            {t('actions.delete')}
          </MenuItem>
        </MenuContent>
      </Menu>
      {open === 'edit' && <SmartListDialog list={list} onClose={() => setOpen(null)} />}
      {open === 'delete' && (
        <ResponsiveDialog
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={t('confirmDelete.title', { name: list.name })}
          description={t('confirmDelete.text')}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                {tc('cancel')}
              </Button>
              <Button variant="danger" icon={<Trash2 />} onClick={() => void remove()}>
                {t('confirmDelete.confirm')}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

/**
 * A smart list: its conditions on top (they can be changed right here and
 * saved), the tasks that match below. With no id — a new list being built.
 */
export function SmartListScreen({ id }: { id: string | null }) {
  const t = useTranslations('lists');
  const te = useTranslations('tasks.empty.listMissing');
  const tt = useTranslations('tasks');
  const catalog = useCatalog();
  const actions = useTaskActions();
  const list = id ? catalog?.savedFilterById.get(id) : undefined;
  const stored = useMemo(() => sanitizeQuery(list?.query), [list?.query]);
  // Edits not saved yet, for this list only.
  const [draft, setDraft] = useState<{ id: string | null; query: TaskQuery } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!catalog) return null;
  if (id && (!list || list.deleted_at)) return <EmptyState title={te('title')} description={te('text')} />;

  const editing = draft && draft.id === id ? draft.query : null;
  const query = editing ?? stored;
  const dirty = id !== null && editing !== null && JSON.stringify(sanitizeQuery(editing)) !== JSON.stringify(stored);

  const saveConditions = async () => {
    if (!id || !editing) return;
    setBusy(true);
    try {
      const inverse = await updateSmartList(actions.ctx, id, { query: editing });
      actions.record(t('toast.saved'), inverse, t('toast.saved'));
      setDraft(null);
    } catch {
      toast.error(tt('toast.failed'));
    } finally {
      setBusy(false);
    }
  };

  // Saving sits under the conditions: a new list is saved once, a saved one when its conditions changed.
  const buttons = id ? (
    dirty && (
      <>
        <Button size="sm" variant="primary" loading={busy} onClick={() => void saveConditions()}>
          {t('saveChanges')}
        </Button>
        <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => setDraft(null)}>
          {t('discard')}
        </Button>
      </>
    )
  ) : (
    <Button size="sm" variant="primary" onClick={() => setSaving(true)}>
      {t('save')}
    </Button>
  );
  const bare = activeParts(query) === 0;

  return (
    <>
      <TaskListView
        scope={{ kind: 'smart', listId: id, query }}
        title={list?.name ?? t('new')}
        chrome={{
          lead: <SmartListMark color={list?.color ?? 'ash'} size="lg" />,
          eyebrow: <p className="label-mono mb-2">{t('eyebrow')}</p>,
          actions: list && <SmartListMenu list={list} />,
          below: (
            <div className="flex flex-col gap-3">
              {!id && <p className="max-w-2xl text-base text-fg-2">{t('newHint')}</p>}
              <FilterBar query={query} onChange={(next) => setDraft({ id, query: next })} />
              {(buttons || bare) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {buttons}
                  {bare && <p className="text-sm text-fg-3">{t('noConditions')}</p>}
                </div>
              )}
            </div>
          ),
        }}
      />
      {saving && (
        <SmartListDialog
          query={query}
          sort={useListViews.getState().sort['smart:new'] ?? 'due'}
          onClose={() => setSaving(false)}
          onCreated={() => setDraft(null)}
        />
      )}
    </>
  );
}
