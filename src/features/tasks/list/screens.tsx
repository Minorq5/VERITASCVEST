'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui/empty-state';
import type { Section } from '@/lib/domain/sections';
import { useCatalog } from '../data/hooks';
import { TaskListView } from './list-view';

export function SectionScreen({ section }: { section: Section }) {
  const t = useTranslations('nav');
  return <TaskListView scope={{ kind: 'section', section }} title={t(section)} />;
}

export function ProjectScreen({ id }: { id: string }) {
  const t = useTranslations('tasks.empty.projectMissing');
  const catalog = useCatalog();
  if (!catalog) return null;
  const project = catalog.projectById.get(id);
  if (!project || project.deleted_at) return <EmptyState title={t('title')} description={t('text')} />;
  return <TaskListView scope={{ kind: 'project', projectId: id }} title={project.name} />;
}
