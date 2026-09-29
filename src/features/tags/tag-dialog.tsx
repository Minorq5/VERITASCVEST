'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { swatchFor, swatchNames, swatchVar, toSwatch, type SwatchName } from '@/lib/color/swatches';
import type { TagRow } from '@/lib/db/types';
import { sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { cleanTagName, createTag, tagNamed, updateTag } from './actions';

/** Create a tag, or rename and recolour one. */
export function TagDialog({ tag, onClose }: { tag?: TagRow; onClose: () => void }) {
  const t = useTranslations('tags');
  const tc = useTranslations('common');
  const colors = useTranslations('tasks.colors');
  const actions = useTaskActions();
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<SwatchName>(tag ? toSwatch(tag.color) : 'ash');
  const [touched, setTouched] = useState(Boolean(tag));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = cleanTagName(name);
  const shownColor = touched || !clean ? color : swatchFor(clean);

  const save = async () => {
    if (!clean) {
      setError(t('form.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      const taken = await tagNamed(actions.ctx, clean, tag?.id);
      if (taken) {
        setError(t('form.nameTaken', { name: taken.name }));
        return;
      }
      if (tag) {
        const inverse = await updateTag(actions.ctx, tag.id, { name: clean, color: shownColor });
        actions.record(t('toast.saved'), inverse);
        toast.success(t('toast.saved'));
      } else {
        const { inverse } = await createTag(actions.ctx, clean, shownColor);
        actions.record(t('toast.created'), inverse, t('toast.created'));
        sound.play('taskCreate');
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
      title={tag ? t('form.editTitle') : t('form.createTitle')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {tag ? t('form.save') : t('form.create')}
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
        <Field label={t('form.name')} error={error} hint={t('form.nameHint')}>
          <Input
            value={name}
            maxLength={41}
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
