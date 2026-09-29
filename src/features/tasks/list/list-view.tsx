'use client';

import { ListChecks, ListFilter, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterBar } from '@/features/filters/filter-bar';
import { filterPartsFor, queryForScope } from '@/features/filters/scope-query';
import { SmartListDialog } from '@/features/filters/smart-list-dialog';
import { SortMenu } from '@/features/filters/sort-menu';
import { useListSort } from '@/features/filters/use-list-sort';
import { useListFilters } from '@/stores/list-views';
import { useSyncStatus } from '@/stores/sync-status';
import { activeParts, matchesQuery } from '@/lib/domain/filters';
import { trashDaysLeft } from '@/lib/domain/sections';
import { isTyping, overlayOpen, useKeydown } from '@/lib/hooks/use-hotkeys';
import { addDays } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import { useCatalog, useCompletions, usePlannerPrefs, useTaskIndex, useTasks, useToday } from '../data/hooks';
import { useLingering } from '../data/lingering';
import { useTaskActions } from '../data/use-task-actions';
import { dayHeader, formatClock, formatLongDate, formatShortDate } from '../format';
import { QuickAdd } from '../quick-add/quick-add';
import { scopeKey, useQuickAdd, type ListScope } from '../quick-add/store';
import { useSelection } from '../shared/selection';
import { useTaskRoute } from '../shared/use-task-route';
import { buildGroups, queryContext } from './build-groups';
import { BulkBar } from './bulk-bar';
import { ConfirmPurge } from './confirm-purge';
import { indexChildren, type RowContext, type RowModel } from './row-model';
import { TaskList } from './task-list';
import { TemplatesButton } from '../templates/templates-dialog';
import { TodaySummary } from './today-summary';

type Scope = NonNullable<ListScope>;

function ListSkeleton() {
  return (
    <div className="bg-surface-1 overflow-hidden rounded-xl border border-line" aria-hidden>
      {['w-[90%]', 'w-[60%]', 'w-[75%]', 'w-[50%]', 'w-[80%]'].map((w, i) => (
        <div key={i} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <Skeleton className="size-[22px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className={`h-4 ${w}`} />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ListChrome {
  /** Next to the title (a project's planet). */
  lead?: ReactNode;
  /** A line above the title instead of the default one. */
  eyebrow?: ReactNode;
  /** Buttons at the right of the header, before the list's own. */
  actions?: ReactNode;
  /** Between the header and the list (subprojects, a notice). */
  below?: ReactNode;
}

export function TaskListView({ scope, title, chrome }: { scope: Scope; title: string; chrome?: ListChrome }) {
  const t = useTranslations('tasks');
  const tf = useTranslations('filters');
  const tasks = useTasks();
  const catalog = useCatalog();
  const index = useTaskIndex();
  const completions = useCompletions();
  const prefs = usePlannerPrefs();
  const { today, now } = useToday();
  const actions = useTaskActions();
  const lingering = useLingering((s) => s.rows);
  const { openId, open } = useTaskRoute();
  const selected = useSelection((s) => s.ids);
  const [selecting, setSelecting] = useState(false);
  const [purge, setPurge] = useState<string[] | null>(null);
  const syncStatus = useSyncStatus((s) => s.status);
  const key = scopeKey(scope);
  // A smart list being edited changes its query, not its key.
  const signature = scope.kind === 'smart' ? `${key}:${JSON.stringify(scope.query)}` : key;
  const section = scope.kind === 'section' ? scope.section : null;
  const sort = useListSort(scope);
  const filterParts = filterPartsFor(scope);
  const filter = useListFilters((s) => s.queries[key]);
  const filterOpen = useListFilters((s) => s.open[key] ?? false);
  const filterCount = filterParts && filter ? activeParts(filter) : 0;
  const filtering = filterCount > 0;
  const [savingList, setSavingList] = useState(false);

  // New tasks from the "+" button and N land in the list on screen.
  useEffect(() => {
    useQuickAdd.getState().setScope(scope);
    return () => useQuickAdd.getState().setScope(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature identifies the scope
  }, [signature]);
  useEffect(() => () => useSelection.getState().clear(), [key]);

  const rc: RowContext | null = useMemo(() => {
    if (!tasks || !catalog || !index) return null;
    return {
      catalog,
      index,
      childrenOf: indexChildren(tasks),
      tasksById: new Map(tasks.map((task) => [task.id, task])),
      today,
      now,
      timeZone: prefs.timeZone,
      weekStart: prefs.weekStart,
      hideProjectId: scope.kind === 'project' ? scope.projectId : undefined,
      hideTagId: scope.kind === 'tag' ? scope.tagId : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope is identified by its key
  }, [tasks, catalog, index, today, now, prefs.timeZone, prefs.weekStart, key]);

  const listTasks = useMemo(() => {
    if (!tasks || !catalog || !rc) return tasks;
    let list = tasks;
    // Tasks of archived projects stay out of every list except the project's own page.
    if (scope.kind !== 'project' && catalog.hiddenProjectIds.size) {
      list = list.filter((t) => !t.project_id || !catalog.hiddenProjectIds.has(t.project_id));
    }
    // The filter narrows the list; whether done tasks show is the list's own business.
    if (filtering && filter) {
      const qctx = queryContext(rc);
      const query = { ...filter, state: 'all' as const };
      list = list.filter((t) => matchesQuery(t, query, qctx));
    }
    return list;
  }, [tasks, catalog, rc, scope.kind, filtering, filter]);

  const sortMode = sort?.mode ?? 'due';
  const groups = useMemo(() => {
    if (!rc || !listTasks || !completions) return null;
    return buildGroups({
      scope,
      tasks: listTasks,
      completions,
      lingering,
      rc,
      sort: sortMode,
      locale: prefs.locale,
      dayTitle: (date) => dayHeader(date, today, prefs.locale, t),
      overdueTitle: t('summary.overdue'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope is identified by its signature
  }, [rc, listTasks, completions, lingering, signature, sortMode, today, prefs.locale, t]);

  const orderedIds = useMemo(() => groups?.flatMap((g) => g.rows.map((r) => r.task.id)) ?? [], [groups]);
  const rowsById = useMemo(() => new Map(groups?.flatMap((g) => g.rows.map((r) => [r.task.id, r] as const)) ?? []), [groups]);
  const onSelect = (id: string, range: boolean) => {
    setSelecting(true);
    if (range) useSelection.getState().selectRange(orderedIds, id);
    else useSelection.getState().toggle(id);
  };

  // List keys: J/K move, Space completes, X selects, Delete trashes.
  useKeydown((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event) || overlayOpen()) return;
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-id]');
    const focusedId = focused?.dataset.taskId ?? null;
    const rows = Array.from(document.querySelectorAll<HTMLElement>('main [data-task-id] [data-row-open]'));
    const move = (delta: number) => {
      if (!rows.length) return;
      const current = focused ? rows.findIndex((r) => focused.contains(r)) : -1;
      const next = rows[Math.max(0, Math.min(rows.length - 1, current < 0 ? 0 : current + delta))];
      next?.focus();
      next?.scrollIntoView({ block: 'nearest' });
    };
    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        if (event.key === 'ArrowDown' && !focused) return;
        event.preventDefault();
        move(1);
        break;
      case 'k':
      case 'ArrowUp':
        if (event.key === 'ArrowUp' && !focused) return;
        event.preventDefault();
        move(-1);
        break;
      case ' ':
      case 'x':
      case 'e':
      case 'Delete':
      case 'Backspace': {
        if (!focusedId) return;
        const model = rowsById.get(focusedId);
        if (!model) return;
        event.preventDefault();
        if (event.key === ' ') void actions.toggle(model.task);
        else if (event.key === 'x') onSelect(focusedId, event.shiftKey);
        else if (event.key === 'e') open(focusedId);
        else if (section === 'trash') setPurge([focusedId]);
        else void actions.trash(selected.size ? [...selected] : [focusedId]);
        break;
      }
      case 'f':
        if (!filterParts) return;
        event.preventDefault();
        useListFilters.getState().setOpen(key, !filterOpen);
        break;
      case 'Escape':
        if (selected.size || selecting) {
          useSelection.getState().clear();
          setSelecting(false);
        }
        break;
    }
  });

  const showQuickAdd =
    scope.kind === 'project' ||
    scope.kind === 'tag' ||
    (scope.kind === 'smart' && (scope.query.state ?? 'open') !== 'done') ||
    (section !== null && ['inbox', 'today', 'tomorrow', 'week'].includes(section));
  const emptyKey = scope.kind === 'section' ? scope.section : scope.kind;
  const loading = !groups;
  const firstSync = !syncStatus?.bootstrapped && (tasks?.length ?? 0) === 0;
  const empty = groups !== null && groups.every((g) => g.rows.length === 0);
  const trashIds = section === 'trash' ? orderedIds : [];

  const subtitle = (() => {
    if (section === 'today') return formatLongDate(today, prefs.locale, today);
    if (section === 'tomorrow') return formatLongDate(addDays(today, 1), prefs.locale, today);
    if (section === 'week') return `${formatShortDate(today, prefs.locale, today)} — ${formatShortDate(addDays(today, 6), prefs.locale, today)}`;
    return null;
  })();
  // A sentence, not a label: it goes under the title in plain text.
  const hint = section === 'trash' ? t('trash.hint') : null;

  const note = (row: RowModel) => {
    if (section === 'trash' && row.task.deleted_at) {
      const days = trashDaysLeft(row.task.deleted_at, now);
      const children = rc?.childrenOf.get(row.task.id)?.length ?? 0;
      return (
        <span className={cn(days <= 3 ? 'text-warning' : 'text-fg-3')}>
          {days <= 0 ? t('trash.lastDay') : t('trash.daysLeft', { days })}
          {children > 0 && ` · ${t('trash.withSubtasks', { count: children })}`}
        </span>
      );
    }
    if (row.completedAt) {
      const time = formatClock(new Date(row.completedAt), prefs.locale, prefs.hour12, prefs.timeZone);
      return <span>{row.key ? `${t('row.recurringDone')} · ${time}` : t('row.completedAt', { time })}</span>;
    }
    return null;
  };


  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line pb-4">
        <div className="flex min-w-0 items-center gap-4">
          {chrome?.lead}
          <div className="min-w-0">
            {chrome?.eyebrow ?? (subtitle && <p className="label-mono mb-2">{subtitle}</p>)}
            <h1 className="font-display text-3xl font-medium break-words text-fg">{title}</h1>
            {hint && <p className="mt-1.5 text-sm text-fg-3">{hint}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {chrome?.actions}
          {filterParts && (
            <Button
              size="sm"
              variant={filterOpen || filtering ? 'secondary' : 'ghost'}
              icon={<ListFilter />}
              aria-pressed={filterOpen}
              aria-label={filtering ? tf('buttonActive', { count: filterCount }) : tf('button')}
              onClick={() => useListFilters.getState().setOpen(key, !filterOpen)}
            >
              <span className="max-sm:sr-only">{tf('button')}</span>
              {filtering && <span className="font-mono text-xs text-accent tabular">{filterCount}</span>}
            </Button>
          )}
          {sort && <SortMenu sort={sort} />}
          {showQuickAdd && (scope.kind === 'section' || scope.kind === 'project') && <TemplatesButton scope={scope} />}
          {section === 'trash' && trashIds.length > 0 && (
            <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setPurge(trashIds)}>
              {t('actions.emptyTrash')}
            </Button>
          )}
          {!empty && section !== 'completed' && (
            <Button
              size="sm"
              variant={selecting ? 'secondary' : 'ghost'}
              icon={<ListChecks />}
              aria-pressed={selecting}
              onClick={() => {
                if (selecting) useSelection.getState().clear();
                setSelecting(!selecting);
              }}
            >
              {t('actions.select')}
            </Button>
          )}
        </div>
      </header>

      {chrome?.below}

      {filterParts && (filterOpen || filtering) && (
        <FilterBar
          query={filter ?? {}}
          parts={filterParts}
          onChange={(query) => useListFilters.getState().setQuery(key, query)}
          trailing={
            filtering && (
              <>
                <Button size="sm" variant="ghost" icon={<X />} onClick={() => useListFilters.getState().clear(key)}>
                  {tf('reset')}
                </Button>
                <Button size="sm" variant="link" className="ml-1 text-sm" onClick={() => setSavingList(true)}>
                  {tf('saveAsList')}
                </Button>
              </>
            )
          }
        />
      )}
      {savingList && filter && (
        <SmartListDialog
          query={queryForScope(scope, filter)}
          sort={sortMode === 'manual' ? 'due' : sortMode}
          onClose={() => setSavingList(false)}
          onCreated={() => useListFilters.getState().clear(key)}
        />
      )}

      {section === 'today' && rc && tasks && completions && (
        <TodaySummary tasks={listTasks ?? tasks} completions={completions} rc={rc} actions={actions} prefs={prefs} />
      )}

      {showQuickAdd && <QuickAdd scope={scope} />}

      {loading || (firstSync && empty) ? (
        <ListSkeleton />
      ) : empty && filtering ? (
        <EmptyState
          title={t('empty.filtered.title')}
          description={t('empty.filtered.text')}
          action={
            <Button variant="secondary" icon={<X />} onClick={() => useListFilters.getState().clear(key)}>
              {tf('resetFilter')}
            </Button>
          }
        />
      ) : empty ? (
        <EmptyState title={t(`empty.${emptyKey}.title`)} description={t(`empty.${emptyKey}.text`)} />
      ) : (
        groups.map((group) =>
          group.rows.length === 0 ? null : (
            <motion.section key={group.key} layout="position" className="flex flex-col gap-2" aria-label={group.title ?? title}>
              {group.title && (
                <div className="flex h-6 items-center justify-between gap-3 px-1">
                  <h2 className={cn('label-mono', group.tone === 'danger' && 'text-danger')}>
                    {group.title}
                    <span className="ml-2 tabular">{group.rows.length}</span>
                  </h2>
                  {group.key === 'overdue' && section === 'today' && (
                    <Button
                      size="sm"
                      variant="link"
                      className="h-6 text-sm"
                      onClick={() => void actions.setDue(group.rows.map((r) => r.task.id), today, t('dates.today'))}
                    >
                      {t('summary.moveAllToday')}
                    </Button>
                  )}
                </div>
              )}
              <TaskList
                rows={group.rows}
                today={today}
                prefs={prefs}
                actions={actions}
                activeId={openId}
                selected={selected}
                selecting={selecting}
                lingering={lingering}
                onOpen={open}
                onSelect={onSelect}
                variant={section === 'trash' ? 'trash' : section === 'completed' ? 'completed' : 'list'}
                hideDate={group.hideDate}
                sortable={group.sortable && !selecting}
                note={note}
                label={group.title ?? title}
              />
            </motion.section>
          ),
        )
      )}

      <BulkBar
        ids={[...selected]}
        rowsById={rowsById}
        trash={section === 'trash'}
        today={today}
        prefs={prefs}
        actions={actions}
        onPurge={(ids) => setPurge(ids)}
        onDone={() => {
          useSelection.getState().clear();
          setSelecting(false);
        }}
      />
      <ConfirmPurge
        ids={purge}
        title={purge?.length === 1 ? (rowsById.get(purge[0]!)?.task.title ?? '') : null}
        emptying={section === 'trash' && purge !== null && purge.length === trashIds.length && purge.length > 1}
        onClose={() => setPurge(null)}
        onConfirm={async (ids, emptying) => {
          await (emptying ? actions.emptyTrash(ids) : actions.purge(ids));
          useSelection.getState().clear();
          setSelecting(false);
          setPurge(null);
        }}
      />
    </div>
  );
}

