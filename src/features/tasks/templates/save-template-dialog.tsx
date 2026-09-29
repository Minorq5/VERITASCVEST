'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import type { TagRow, TaskRow } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { toast } from '@/stores/toasts';
import { useCatalog, useTasks, type TaskParts } from '../data/hooks';
import { useTaskActions } from '../data/use-task-actions';
import { payloadFromTask } from './payload';

export function SaveTemplateDialog({ task, parts, onClose }: { task: TaskRow; parts: TaskParts; onClose: () => void }) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const catalog = useCatalog();
  const tasks = useTasks();
  const actions = useTaskActions();
  const [name, setName] = useState(task.title.slice(0, 80));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const clean = name.trim();
    if (!clean || !catalog) return;
    setBusy(true);
    try {
      const priority = task.priority_id ? catalog.priorityById.get(task.priority_id) : undefined;
      const payload = payloadFromTask(task, {
        priorityKey: priority?.system_key ?? null,
        tags: parts.tagIds.map((id) => catalog.tagById.get(id)).filter((tag): tag is TagRow => Boolean(tag)),
        milestones: parts.milestones,
        subtasks: (tasks ?? []).filter((x) => x.parent_id === task.id),
      });
      const { inverse } = await actions.ctx.repo.insert('templates', {
        id: newId(),
        owner_id: actions.ctx.userId,
        kind: 'task',
        name: clean.slice(0, 80),
        icon: null,
        payload,
        deleted_at: null,
      } as never);
      actions.record(t('toast.templateSaved'), inverse);
      toast.success(t('toast.templateSaved'));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('actions.saveAsTemplate')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void save()}>
            {t('templates.save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={t('templates.name')}>
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}
