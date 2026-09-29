'use client';

import { ChevronDown, Flag, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { Planet } from '@/features/cinema/planet/planet';
import { projectForest, type ProjectNode } from '@/features/projects/stats';
import { useCatalog } from '@/features/tasks/data/hooks';
import { typeMeta } from '@/features/tasks/shared/type-meta';
import { priorityVar, swatchVar } from '@/lib/color/swatches';
import type { ProjectRow } from '@/lib/db/types';
import { dueFilters, taskStates, type TaskQuery, type TaskState } from '@/lib/domain/filters';
import { taskTypes } from '@/lib/domain/task-types';
import { cn } from '@/lib/utils/cn';

/** Parts of a query a filter bar can edit. */
export type FilterPart = 'state' | 'due' | 'priorities' | 'statuses' | 'types' | 'projects' | 'tags';
export const allParts: readonly FilterPart[] = ['state', 'due', 'priorities', 'statuses', 'types', 'projects', 'tags'];

const NONE = 'none';

const chipClass = (active: boolean) =>
  cn(
    'focus-ring inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-sm border px-2.5 text-sm transition-colors duration-90',
    active
      ? 'border-accent/55 bg-surface-2 text-fg hover-ok:border-accent'
      : 'border-dashed border-line-strong text-fg-2 hover-ok:border-line-bright hover-ok:text-fg',
  );

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  depth?: number;
}

/** One part of the filter: a chip that opens a list of choices (several can be on). */
function MultiChip<T extends string>({
  label,
  values,
  options,
  onChange,
  footer,
}: {
  label: string;
  values: readonly T[] | undefined;
  options: readonly Option<T>[];
  onChange: (values: T[] | undefined) => void;
  footer?: ReactNode;
}) {
  const t = useTranslations('filters');
  const chosen = options.filter((o) => values?.includes(o.value));
  const summary =
    chosen.length === 0
      ? null
      : chosen.length <= 2
        ? chosen.map((o) => o.label).join(', ')
        : t('andMore', { first: chosen[0]!.label, count: chosen.length - 1 });
  const toggle = (value: T, on: boolean) => {
    const next = new Set(values ?? []);
    if (on) next.add(value);
    else next.delete(value);
    const list = options.map((o) => o.value).filter((v) => next.has(v));
    onChange(list.length ? list : undefined);
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className={chipClass(chosen.length > 0)} aria-label={summary ? `${label}: ${summary}` : label}>
          <span className={cn('shrink-0', chosen.length > 0 && 'text-fg-3')}>{label}</span>
          {summary && <span className="min-w-0 truncate">{summary}</span>}
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-fg-3" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        {options.length === 0 && <p className="px-2.5 py-2 text-sm text-fg-3">{t('nothingToPick')}</p>}
        {options.map((o) => (
          <MenuCheckboxItem
            key={o.value}
            checked={values?.includes(o.value) ?? false}
            onCheckedChange={(on) => toggle(o.value, on === true)}
            // Several choices in one go: the menu stays open.
            onSelect={(e) => e.preventDefault()}
            style={o.depth ? { paddingLeft: 32 + o.depth * 14 } : undefined}
          >
            {o.icon}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
          </MenuCheckboxItem>
        ))}
        {footer}
        {chosen.length > 0 && (
          <>
            <MenuSeparator />
            <MenuItem icon={<X />} onSelect={() => onChange(undefined)}>
              {t('clearPart')}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

function flatten(nodes: ProjectNode<ProjectRow>[], out: ProjectNode<ProjectRow>[] = []) {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

/**
 * The filter builder: a row of chips, one per part (deadline, priority,
 * status, type, project, tag, and for smart lists — open or done).
 * Choices inside a part are alternatives; parts narrow each other.
 */
export function FilterBar({
  query,
  onChange,
  parts = allParts,
  trailing,
  className,
}: {
  query: TaskQuery;
  onChange: (query: TaskQuery) => void;
  parts?: readonly FilterPart[];
  /** Buttons at the end of the row (save, reset). */
  trailing?: ReactNode;
  className?: string;
}) {
  const t = useTranslations('filters');
  const tt = useTranslations('tasks');
  const catalog = useCatalog();
  const set = <K extends keyof TaskQuery>(key: K, value: TaskQuery[K]) => {
    const next = { ...query, [key]: value };
    if (value === undefined) delete next[key];
    if (key === 'tags' && (!value || (value as string[]).length < 2)) delete next.tagMode;
    onChange(next);
  };

  const projects = useMemo(() => (catalog ? flatten(projectForest(catalog.projects)) : []), [catalog]);
  if (!catalog) return null;

  const priorityOptions: Option<string>[] = [
    ...(['critical', 'high', 'medium', 'low'] as const).flatMap((key) => {
      const row = catalog.priorityByKey.get(key);
      return row ? [{ value: row.id, label: tt(`priority.${key}`), icon: <Flag aria-hidden style={{ color: priorityVar(key) }} /> }] : [];
    }),
    { value: NONE, label: tt('priority.none'), icon: <Flag aria-hidden className="text-fg-4" /> },
  ];
  const statusOptions: Option<string>[] = catalog.statuses.map((s) => ({
    value: s.id,
    label: s.system_key ? tt(`status.${s.system_key as 'todo'}`) : (s.name ?? ''),
    icon: <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: swatchVar(s.color) }} />,
  }));
  const typeOptions = taskTypes.map((type) => {
    const Icon = typeMeta[type].icon;
    return { value: type, label: tt(`types.${type}.name`), icon: <Icon aria-hidden style={{ color: typeMeta[type].color }} /> };
  });
  const projectOptions: Option<string>[] = [
    { value: NONE, label: t('noProject') },
    ...projects.map((n) => ({
      value: n.project.id,
      label: n.project.name,
      depth: n.depth,
      icon: <Planet seed={n.project.planet_seed} color={n.project.color} size={14} />,
    })),
  ];
  const tagOptions: Option<string>[] = catalog.tags.map((tag) => ({
    value: tag.id,
    label: `#${tag.name}`,
    icon: <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: swatchVar(tag.color) }} />,
  }));
  const state = query.state ?? 'open';

  return (
    <div role="group" aria-label={t('label')} className={cn('flex flex-wrap items-center gap-2', className)}>
      {parts.includes('state') && (
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={chipClass(state !== 'open')} aria-label={`${t('parts.state')}: ${t(`state.${state}`)}`}>
              <span className="text-fg-3">{t('parts.state')}</span>
              <span>{t(`state.${state}`)}</span>
              <ChevronDown aria-hidden className="size-3.5 text-fg-3" />
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuRadioGroup value={state} onValueChange={(v) => set('state', v === 'open' ? undefined : (v as TaskState))}>
              {taskStates.map((s) => (
                <MenuRadioItem key={s} value={s}>
                  {t(`state.${s}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
      )}
      {parts.includes('due') && (
        <MultiChip
          label={t('parts.due')}
          values={query.due}
          options={dueFilters.map((d) => ({ value: d, label: t(`due.${d}`) }))}
          onChange={(v) => set('due', v)}
        />
      )}
      {parts.includes('priorities') && (
        <MultiChip label={t('parts.priorities')} values={query.priorities} options={priorityOptions} onChange={(v) => set('priorities', v)} />
      )}
      {parts.includes('statuses') && (
        <MultiChip label={t('parts.statuses')} values={query.statuses} options={statusOptions} onChange={(v) => set('statuses', v)} />
      )}
      {parts.includes('types') && <MultiChip label={t('parts.types')} values={query.types} options={typeOptions} onChange={(v) => set('types', v)} />}
      {parts.includes('projects') && (
        <MultiChip label={t('parts.projects')} values={query.projects} options={projectOptions} onChange={(v) => set('projects', v)} />
      )}
      {parts.includes('tags') && (
        <MultiChip
          label={t('parts.tags')}
          values={query.tags}
          options={tagOptions}
          onChange={(v) => set('tags', v)}
          footer={
            (query.tags?.length ?? 0) > 1 && (
              <>
                <MenuSeparator />
                <MenuLabel>{t('tagMode.label')}</MenuLabel>
                <MenuRadioGroup value={query.tagMode ?? 'any'} onValueChange={(v) => set('tagMode', v === 'all' ? 'all' : undefined)}>
                  <MenuRadioItem value="any" onSelect={(e) => e.preventDefault()}>
                    {t('tagMode.any')}
                  </MenuRadioItem>
                  <MenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>
                    {t('tagMode.all')}
                  </MenuRadioItem>
                </MenuRadioGroup>
              </>
            )
          }
        />
      )}
      {trailing}
    </div>
  );
}
