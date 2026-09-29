'use client';

import { ArchiveRestore, ChevronRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressRing } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Planet } from '@/features/cinema/planet/planet';
import { useCatalog, useTasks, useToday } from '@/features/tasks/data/hooks';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { Link } from '@/i18n/navigation';
import { swatchVar } from '@/lib/color/swatches';
import type { ProjectRow } from '@/lib/db/types';
import { cn } from '@/lib/utils/cn';
import { sound } from '@/sound/engine';
import { setArchived } from './actions';
import { ProjectDialog } from './project-dialog';
import { projectForest, projectStats, type ProjectNode, type ProjectStats } from './stats';

/** One line of numbers under a project: open tasks, overdue, done of total. */
export function StatsLine({ stats, className }: { stats: ProjectStats | undefined; className?: string }) {
  const t = useTranslations('projects');
  const s = stats ?? { open: 0, overdue: 0, done: 0, ratio: 0 };
  const total = s.open + s.done;
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tracking-[0.04em] text-fg-3 tabular', className)}>
      {total === 0 ? (
        <span>{t('noTasks')}</span>
      ) : (
        <>
          <span>{t('open', { count: s.open })}</span>
          {s.overdue > 0 && <span className="text-danger">{t('overdue', { count: s.overdue })}</span>}
          <span>{t('progress', { done: s.done, total })}</span>
        </>
      )}
    </p>
  );
}

function ProjectCard({ node, stats }: { node: ProjectNode<ProjectRow>; stats: Map<string, ProjectStats> }) {
  const t = useTranslations('projects');
  const { project, children } = node;
  const s = stats.get(project.id);
  return (
    <li className="group/card relative flex flex-col gap-4 rounded-md border border-line bg-surface-1 p-4 transition-colors duration-90 hover-ok:border-line-bright">
      <div className="flex items-center gap-4">
        <ProgressRing value={s?.ratio ?? 0} size={72} stroke={1.5} color={swatchVar(project.color)} showValue={false}>
          <Planet seed={project.planet_seed} color={project.color} size={60} />
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-snug font-medium text-fg">
            {/* The whole card opens the project. */}
            <Link href={`/projects/${project.id}`} className="focus-ring rounded-xs after:absolute after:inset-0 after:content-['']">
              {project.name}
            </Link>
          </h2>
          <StatsLine stats={s} className="mt-1.5" />
        </div>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-4 transition-colors group-hover/card:text-fg-2" />
      </div>
      {project.description && <p className="line-clamp-2 text-sm text-fg-2">{project.description}</p>}
      {children.length > 0 && (
        <div className="relative z-[1] border-t border-line pt-3">
          <p className="label-mono mb-2">{t('subprojects')}</p>
          <ul className="flex flex-col gap-1">
            {children.map((child) => (
              <li key={child.project.id}>
                <Link
                  href={`/projects/${child.project.id}`}
                  className="focus-ring flex h-8 items-center gap-2.5 rounded-xs px-1.5 text-sm text-fg-2 transition-colors hover-ok:bg-surface-2 hover-ok:text-fg"
                >
                  <Planet seed={child.project.planet_seed} color={child.project.color} size={20} />
                  <span className="min-w-0 flex-1 truncate">{child.project.name}</span>
                  <span className="font-mono text-xs text-fg-3 tabular">{stats.get(child.project.id)?.open ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function ArchiveList({ projects }: { projects: ProjectRow[] }) {
  const t = useTranslations('projects');
  const actions = useTaskActions();
  if (projects.length === 0) return null;
  return (
    <details className="group/archive rounded-md border border-line">
      <summary className="focus-ring flex h-11 cursor-pointer list-none items-center gap-2 rounded-md px-4 text-sm text-fg-2 hover-ok:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-fg-3 transition-transform group-open/archive:rotate-90" />
        <span>{t('archive')}</span>
        <span className="ml-auto font-mono text-xs text-fg-3">{t('archivedCount', { count: projects.length })}</span>
      </summary>
      <ul className="border-t border-line">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
            <Planet seed={project.planet_seed} color={project.color} size={24} />
            <Link href={`/projects/${project.id}`} className="focus-ring min-w-0 flex-1 truncate rounded-xs text-base text-fg-2 hover-ok:text-fg">
              {project.name}
            </Link>
            <Button
              size="sm"
              variant="ghost"
              icon={<ArchiveRestore />}
              onClick={async () => {
                const inverse = await setArchived(actions.ctx, project.id, false);
                actions.record(t('toast.unarchived'), inverse, t('toast.unarchived'));
                sound.play('undo');
              }}
            >
              {t('actions.unarchive')}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ProjectsScreen() {
  const t = useTranslations('projects');
  const catalog = useCatalog();
  const tasks = useTasks();
  const { today, now } = useToday();
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    if (!catalog || !tasks) return null;
    return projectStats(tasks, catalog.allProjects, { today, now });
  }, [catalog, tasks, today, now]);
  const forest = useMemo(() => (catalog ? projectForest(catalog.projects) : []), [catalog]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line pb-4">
        <div>
          {catalog && <p className="label-mono mb-2">{t('count', { count: catalog.projects.length })}</p>}
          <h1 className="font-display text-3xl font-medium text-fg">{t('title')}</h1>
        </div>
        <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setCreating(true)}>
          {t('new')}
        </Button>
      </header>

      {!catalog || !stats ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
      ) : forest.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.text')}
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              {t('new')}
            </Button>
          }
        />
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {forest.map((node) => (
            <ProjectCard key={node.project.id} node={node} stats={stats} />
          ))}
        </ul>
      )}

      {catalog && <ArchiveList projects={catalog.archivedProjects} />}
      {creating && <ProjectDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
