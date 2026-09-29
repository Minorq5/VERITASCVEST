'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { useRouter } from '@/i18n/navigation';
import { swatchFor, swatchNames, swatchVar, toSwatch, type SwatchName } from '@/lib/color/swatches';
import type { SavedFilterRow } from '@/lib/db/types';
import type { TaskQuery } from '@/lib/domain/filters';
import type { SortMode } from '@/lib/domain/sort';
import { sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { createSmartList, updateSmartList } from './actions';

/** Name and colour of a smart list: saving a new one, or editing a saved one. */
export function SmartListDialog({
  list,
  query,
  sort = 'due',
  onClose,
  onCreated,
}: {
  list?: SavedFilterRow;
  /** For a new list: its conditions. */
  query?: TaskQuery;
  sort?: SortMode;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const t = useTranslations('lists');
  const tc = useTranslations('common');
  const colors = useTranslations('tasks.colors');
  const actions = useTaskActions();
  const router = useRouter();
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState<SwatchName>(list ? toSwatch(list.color) : 'blue');
  const [touched, setTouched] = useState(Boolean(list));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shownColor = touched || !name.trim() ? color : swatchFor(name.trim());

  const save = async () => {
    const clean = name.trim();
    if (!clean) {
      setError(t('form.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      if (list) {
        const inverse = await updateSmartList(actions.ctx, list.id, { name: clean, color: shownColor });
        actions.record(t('toast.saved'), inverse);
        toast.success(t('toast.saved'));
      } else {
        const { id, inverse } = await createSmartList(actions.ctx, { name: clean, color: shownColor, query: query ?? {}, sort });
        actions.record(t('toast.created'), inverse, t('toast.created'));
        sound.play('taskCreate');
        onCreated?.(id);
        router.push(`/lists/${id}`);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={list ? t('form.editTitle') : t('form.createTitle')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {list ? t('form.save') : t('form.create')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={t('form.name')} error={error}>
          <Input
            value={name}
            maxLength={60}
            placeholder={t('form.namePlaceholder')}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoFocus
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="label-mono">{t('form.color')}</span>
          <ColorSwatches
            label={t('form.color')}
            value={shownColor}
            onValueChange={(value) => {
              setColor(value);
              setTouched(true);
            }}
            swatches={swatchNames.map((value) => ({ value, color: swatchVar(value), label: colors(value) }))}
            size={24}
          />
        </div>
      </form>
    </ResponsiveDialog>
  );
}
