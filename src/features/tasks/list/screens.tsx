'use client';

import { Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressRing } from '@/components/ui/progress';
import { Planet } from '@/features/cinema/planet/planet';
import { ProjectMenu } from '@/features/projects/project-menu';
import { StatsLine } from '@/features/projects/projects-screen';
import { projectPath, projectStats } from '@/features/projects/stats';
import { Link } from '@/i18n/navigation';
import { swatchVar } from '@/lib/color/swatches';
import type { Section } from '@/lib/domain/sections';
import { useCatalog, useTasks, useToday } from '../data/hooks';
import { TaskListView } from './list-view';

export function SectionScreen({ section }: { section: Section }) {
  const t = useTranslations('nav');
  return <TaskListView scope={{ kind: 'section', section }} title={t(section)} />;
}

export function ProjectScreen({ id }: { id: string }) {
  const t = useTranslations('projects');
  const te = useTranslations('tasks.empty.projectMissing');
  const catalog = useCatalog();
  const tasks = useTasks();
  const { today, now } = useToday();

  const stats = useMemo(() => (tasks && catalog ? projectStats(tasks, catalog.allProjects, { today, now }) : null), [tasks, catalog, today, now]);

  if (!catalog) return null;
  const project = catalog.projectById.get(id);
  if (!project || project.deleted_at) return <EmptyState title={te('title')} description={te('text')} />;

  const path = projectPath(catalog.projectById, id).slice(0, -1);
  const parent = path[path.length - 1];
  const children = catalog.allProjects.filter((p) => p.parent_id === id);
  const s = stats?.get(id);

  return (
    <TaskListView
      scope={{ kind: 'project', projectId: id }}
      title={project.name}
      chrome={{
        lead: (
          <ProgressRing value={s?.ratio ?? 0} size={64} stroke={1.5} color={swatchVar(project.color)} showValue={false} className="shrink-0">
            <Planet seed={project.planet_seed} color={project.color} size={52} />
          </ProgressRing>
        ),
        eyebrow: parent ? (
          <p className="label-mono mb-2">
            <Link href={`/projects/${parent.id}`} className="focus-ring rounded-xs hover-ok:text-fg">
              {t('partOf', { name: parent.name })}
            </Link>
          </p>
        ) : (
          <StatsLine stats={s} className="mb-2" />
        ),
        actions: <ProjectMenu project={project} />,
        below: (
          <>
            {catalog.hiddenProjectIds.has(id) && (
              <p className="flex items-center gap-2 border-l-2 border-warning bg-surface-1 px-3 py-2 text-sm text-fg-2">
                <Archive aria-hidden className="size-4 shrink-0 text-warning" />
                {t('archivedBanner')}
              </p>
            )}
            {parent && <StatsLine stats={s} />}
            {project.description && <p className="max-w-2xl text-base text-fg-2">{project.description}</p>}
            {children.length > 0 && (
              <nav aria-label={t('subprojects')} className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/projects/${child.id}`}
                    className="focus-ring inline-flex h-9 items-center gap-2 rounded-sm border border-line px-2.5 text-sm text-fg-2 transition-colors hover-ok:border-line-bright hover-ok:text-fg"
                  >
                    <Planet seed={child.planet_seed} color={child.color} size={18} />
                    {child.name}
                    <span className="font-mono text-xs text-fg-3 tabular">{stats?.get(child.id)?.open ?? 0}</span>
                  </Link>
                ))}
              </nav>
            )}
          </>
        ),
      }}
    />
  );
}
