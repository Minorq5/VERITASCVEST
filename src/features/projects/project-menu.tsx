'use client';

import { Archive, ArchiveRestore, Ellipsis, FolderPlus, Settings2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useCatalog, useTasks } from '@/features/tasks/data/hooks';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { useRouter } from '@/i18n/navigation';
import type { ProjectRow } from '@/lib/db/types';
import { sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { deleteProject, setArchived, subtreeOf } from './actions';
import { ProjectDialog } from './project-dialog';

type Open = null | 'settings' | 'sub' | 'delete';

/** Settings, a subproject, archive and delete — for one project. */
export function ProjectMenu({ project }: { project: ProjectRow }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const tt = useTranslations('tasks');
  const actions = useTaskActions();
  const catalog = useCatalog();
  const tasks = useTasks();
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);

  const archived = Boolean(project.archived_at);
  const inside = new Set(catalog ? subtreeOf(catalog.allProjects, project.id).map((p) => p.id) : [project.id]);
  const moving = (tasks ?? []).filter((t) => t.project_id && inside.has(t.project_id) && !t.parent_id && !t.deleted_at).length;

  const archive = async () => {
    const inverse = await setArchived(actions.ctx, project.id, !archived);
    const title = archived ? t('toast.unarchived') : t('toast.archived');
    actions.record(title, inverse, title);
    sound.play(archived ? 'undo' : 'trash');
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { inverse } = await deleteProject(actions.ctx, project.id);
      actions.record(t('toast.deleted'), inverse, t('toast.deleted'));
      sound.play('trash');
      setOpen(null);
      router.replace('/projects');
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
          <MenuItem icon={<Settings2 />} onSelect={() => setOpen('settings')}>
            {t('actions.settings')}
          </MenuItem>
          {!archived && (
            <MenuItem icon={<FolderPlus />} onSelect={() => setOpen('sub')}>
              {t('actions.addSub')}
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={archived ? <ArchiveRestore /> : <Archive />} onSelect={() => void archive()}>
            {archived ? t('actions.unarchive') : t('actions.archive')}
          </MenuItem>
          <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setOpen('delete')}>
            {t('actions.delete')}
          </MenuItem>
        </MenuContent>
      </Menu>

      {open === 'settings' && <ProjectDialog project={project} onClose={() => setOpen(null)} />}
      {open === 'sub' && <ProjectDialog parentId={project.id} onClose={() => setOpen(null)} />}
      {open === 'delete' && (
        <ResponsiveDialog
          open
          onOpenChange={(next) => !next && !busy && setOpen(null)}
          title={t('confirmDelete.title', { name: project.name })}
          description={t('confirmDelete.text', { count: moving })}
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
