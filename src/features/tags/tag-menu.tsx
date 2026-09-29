'use client';

import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import type { TagRow } from '@/lib/db/types';
import { sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { deleteTag } from './actions';
import { TagDialog } from './tag-dialog';

/** Rename, recolour or delete a tag. `onDeleted` — where to go after (a tag's own page leaves). */
export function TagMenu({ tag, tasks, onDeleted }: { tag: TagRow; tasks: number; onDeleted?: () => void }) {
  const t = useTranslations('tags');
  const tc = useTranslations('common');
  const tt = useTranslations('tasks');
  const actions = useTaskActions();
  const [open, setOpen] = useState<null | 'edit' | 'delete'>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const { inverse } = await deleteTag(actions.ctx, tag.id);
      actions.record(t('toast.deleted'), inverse, t('toast.deleted'));
      sound.play('trash');
      setOpen(null);
      onDeleted?.();
    } catch {
      toast.error(tt('toast.failed'));
    } finally {
      setBusy(false);
    }
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
      {open === 'edit' && <TagDialog tag={tag} onClose={() => setOpen(null)} />}
      {open === 'delete' && (
        <ResponsiveDialog
          open
          onOpenChange={(next) => !next && !busy && setOpen(null)}
          title={t('confirmDelete.title', { name: tag.name })}
          description={t('confirmDelete.text', { count: tasks })}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(null)} disabled={busy}>
                {tc('cancel')}
              </Button>
              <Button variant="danger" icon={<Trash2 />} loading={busy} onClick={() => void remove()}>
                {t('confirmDelete.confirm')}
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
