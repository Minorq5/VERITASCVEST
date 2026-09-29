'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Planet } from '@/features/cinema/planet/planet';
import { useCatalog } from '@/features/tasks/data/hooks';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { useRouter } from '@/i18n/navigation';
import { swatchFor, swatchNames, swatchVar, toSwatch, type SwatchName } from '@/lib/color/swatches';
import type { ProjectRow } from '@/lib/db/types';
import { sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { createProject, subtreeOf, updateProject } from './actions';
import { projectForest, type ProjectNode } from './stats';

const NO_PARENT = '__none__';

/** Create a project (or a subproject), or edit one: name, planet colour, parent, description. */
export function ProjectDialog({
  project,
  parentId = null,
  onClose,
}: {
  project?: ProjectRow;
  parentId?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const colors = useTranslations('tasks.colors');
  const catalog = useCatalog();
  const actions = useTaskActions();
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState<SwatchName>(project ? toSwatch(project.color) : 'amber');
  const [colorTouched, setColorTouched] = useState(Boolean(project));
  const [parent, setParent] = useState<string>(project?.parent_id ?? parentId ?? NO_PARENT);
  const [description, setDescription] = useState(project?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The planet shown while creating is the one the project gets.
  const [seed] = useState(() => project?.planet_seed ?? Math.floor(Math.random() * 2_147_483_647));

  // A new project's colour follows its name until picked by hand.
  const shownColor = colorTouched || !name.trim() ? color : swatchFor(name.trim());

  // Possible parents: every active project except this one and what is inside it.
  const parents = useMemo(() => {
    if (!catalog) return [] as ProjectNode<ProjectRow>[];
    const blocked = new Set(project ? subtreeOf(catalog.projects, project.id).map((p) => p.id) : []);
    const flat: ProjectNode<ProjectRow>[] = [];
    const walk = (nodes: ProjectNode<ProjectRow>[]) => {
      for (const n of nodes) {
        if (blocked.has(n.project.id)) continue;
        flat.push(n);
        walk(n.children);
      }
    };
    walk(projectForest(catalog.projects));
    return flat;
  }, [catalog, project]);

  const save = async () => {
    const clean = name.trim();
    if (!clean) {
      setError(t('form.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      const input = { name: clean, color: shownColor, parentId: parent === NO_PARENT ? null : parent, description, seed };
      if (project) {
        const inverse = await updateProject(actions.ctx, project.id, input);
        actions.record(t('toast.saved'), inverse);
        toast.success(t('toast.saved'));
      } else {
        const { id, inverse } = await createProject(actions.ctx, input);
        actions.record(t('toast.created'), inverse, t('toast.created'));
        sound.play('taskCreate');
        router.push(`/projects/${id}`);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const title = project ? t('form.editTitle') : parentId ? t('form.createSubTitle') : t('form.createTitle');

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {project ? t('form.save') : t('form.create')}
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
        <div className="flex items-start gap-4">
          <Planet seed={seed} color={shownColor} size={64} className="mt-5" />
          <Field label={t('form.name')} error={error} className="min-w-0 flex-1">
            <Input
              value={name}
              maxLength={120}
              placeholder={t('form.namePlaceholder')}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              autoFocus
            />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label-mono">{t('form.color')}</span>
          <ColorSwatches
            label={t('form.color')}
            value={shownColor}
            onValueChange={(value) => {
              setColor(value);
              setColorTouched(true);
            }}
            swatches={swatchNames.map((value) => ({ value, color: swatchVar(value), label: colors(value) }))}
            size={24}
          />
        </div>
        <Field label={t('form.parent')}>
          <Select value={parent} onValueChange={setParent} aria-label={t('form.parent')}>
            <SelectItem value={NO_PARENT}>{t('form.noParent')}</SelectItem>
            {parents.map((node) => (
              <SelectItem key={node.project.id} value={node.project.id}>
                {`${'  '.repeat(node.depth)}${node.depth ? '└ ' : ''}${node.project.name}`}
              </SelectItem>
            ))}
          </Select>
        </Field>
        <Field label={t('form.description')} optional={tc('optional')}>
          <Textarea value={description} maxLength={2000} rows={3} placeholder={t('form.descriptionPlaceholder')} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}
