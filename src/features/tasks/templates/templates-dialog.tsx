'use client';

import { LayoutTemplate, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import type { TemplateRow } from '@/lib/db/types';
import { isTaskType, ongoingTypes } from '@/lib/domain/task-types';
import { addDays } from '@/lib/time/dates';
import { toast } from '@/stores/toasts';
import { useCatalog, useToday } from '../data/hooks';
import { useTaskActions } from '../data/use-task-actions';
import type { ListScope } from '../quick-add/store';
import { typeMeta } from '../shared/type-meta';
import { useTaskRoute } from '../shared/use-task-route';
import { builtInKeys, builtInPayload, builtInTypes } from './built-in';
import { applyTemplate, templatePayloadSchema, type TemplatePayload } from './payload';

function Item({ type, name, text, onPick, onRemove, removeLabel }: { type: string; name: string; text?: string; onPick: () => void; onRemove?: () => void; removeLabel?: string }) {
  const meta = typeMeta[isTaskType(type) ? type : 'normal'];
  const Icon = meta.icon;
  return (
    <li className="group/tpl flex items-center gap-1">
      <button
        type="button"
        onClick={onPick}
        className="focus-ring flex min-w-0 flex-1 items-start gap-3 rounded-sm px-2.5 py-2 text-left transition-colors hover-ok:bg-surface-3"
      >
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-strong" style={{ color: meta.color }}>
          <Icon aria-hidden className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base text-fg">{name}</span>
          {text && <span className="block truncate text-sm text-fg-3">{text}</span>}
        </span>
      </button>
      {onRemove && (
        <IconButton size="sm" variant="danger" label={removeLabel ?? ''} icon={<Trash2 />} className="pointer-fine:opacity-0 pointer-fine:group-hover/tpl:opacity-100" onClick={onRemove} />
      )}
    </li>
  );
}

/** "From template": built-in ideas and the person's own templates. */
export function TemplatesButton({ scope }: { scope: NonNullable<ListScope> }) {
  const t = useTranslations('tasks');
  const ti = useTranslations('tasks.templates.items');
  const [open, setOpen] = useState(false);
  const catalog = useCatalog();
  const actions = useTaskActions();
  const { today } = useToday();
  const { open: openTask } = useTaskRoute();

  const where = (payload: TemplatePayload) => {
    const section = scope.kind === 'section' ? scope.section : null;
    const ongoing = (ongoingTypes as readonly string[]).includes(payload.task.type);
    return {
      due: ongoing ? null : section === 'today' || section === 'week' ? today : section === 'tomorrow' ? addDays(today, 1) : null,
      projectId: scope.kind === 'project' ? scope.projectId : null,
      today,
    };
  };

  const create = async (payload: TemplatePayload) => {
    setOpen(false);
    try {
      const { id, inverse } = await applyTemplate(actions.ctx, payload, where(payload));
      actions.record(t('templates.created'), inverse, t('templates.created'));
      openTask(id);
    } catch (error) {
      console.error(error);
      toast.error(t('toast.failed'));
    }
  };

  const mine = (catalog?.templates ?? []).filter((tpl) => tpl.kind === 'task');
  const remove = async (tpl: TemplateRow) => {
    const { inverse } = await actions.ctx.repo.update('templates', tpl.id, { deleted_at: new Date().toISOString() });
    actions.record(t('templates.removed'), inverse, t('templates.removed'));
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title={t('templates.title')}
      trigger={
        <Button size="sm" variant="ghost" icon={<LayoutTemplate />}>
          <span className="max-sm:sr-only">{t('actions.fromTemplate')}</span>
        </Button>
      }
    >
      <div className="-mx-2.5 flex flex-col gap-5">
        <section>
          <h3 className="label-mono mb-1 px-2.5">{t('templates.mine')}</h3>
          {mine.length === 0 ? (
            <p className="px-2.5 text-sm text-fg-3">{t('templates.empty')}</p>
          ) : (
            <ul className="flex flex-col">
              {mine.map((tpl) => {
                const parsed = templatePayloadSchema.safeParse(tpl.payload);
                return (
                  <Item
                    key={tpl.id}
                    type={parsed.success ? parsed.data.task.type : 'normal'}
                    name={tpl.name}
                    onPick={() => parsed.success && void create(parsed.data)}
                    onRemove={() => void remove(tpl)}
                    removeLabel={t('templates.remove', { name: tpl.name })}
                  />
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <h3 className="label-mono mb-1 px-2.5">{t('templates.builtIn')}</h3>
          <ul className="grid gap-0.5 sm:grid-cols-2">
            {builtInKeys.map((key) => (
              <Item
                key={key}
                type={builtInTypes[key]}
                name={ti(`${key}.name`)}
                text={ti(`${key}.text`)}
                onPick={() => void create(builtInPayload(key, ti as never, today))}
              />
            ))}
          </ul>
        </section>
      </div>
    </ResponsiveDialog>
  );
}
