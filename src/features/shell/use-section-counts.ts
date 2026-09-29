'use client';

import { useMemo } from 'react';
import { useTasks, useToday } from '@/features/tasks/data/hooks';
import { sectionCounts, type Section } from '@/lib/domain/sections';

/** Live task counts for the navigation. */
export function useSectionCounts(): Record<Section, number> | null {
  const tasks = useTasks();
  const { today, now } = useToday();
  return useMemo(() => (tasks ? sectionCounts(tasks, { today, now }) : null), [tasks, today, now]);
}
