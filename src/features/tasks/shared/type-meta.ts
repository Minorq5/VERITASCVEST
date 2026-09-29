import {
  Flame,
  Hash,
  ListTree,
  Percent,
  Rocket,
  Route,
  ShieldCheck,
  Star,
  Target,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { TaskType } from '@/lib/domain/task-types';

/** Icon and accent of each task type (lists, the type picker, the detail header). */
export const typeMeta: Record<TaskType, { icon: LucideIcon; color: string }> = {
  normal: { icon: Star, color: 'var(--color-swatch-sky)' },
  percent: { icon: Percent, color: 'var(--color-swatch-cyan)' },
  numeric: { icon: Target, color: 'var(--color-swatch-indigo)' },
  subtasks: { icon: ListTree, color: 'var(--color-swatch-teal)' },
  time: { icon: Timer, color: 'var(--color-swatch-violet)' },
  habit: { icon: Flame, color: 'var(--color-swatch-coral)' },
  counter: { icon: Hash, color: 'var(--color-swatch-amber)' },
  stages: { icon: Rocket, color: 'var(--color-swatch-orchid)' },
  collab: { icon: Users, color: 'var(--color-swatch-mint)' },
  abstain: { icon: ShieldCheck, color: 'var(--color-swatch-lime)' },
  chain: { icon: Route, color: 'var(--color-swatch-rose)' },
};
