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

/**
 * Icon and colour of each task type (lists, the type picker, the detail header).
 * Not a rainbow: progress is the light of the disk (accent), a running timer is
 * motion (Doppler blue), the quiet types stay in starlight and steel.
 */
export const typeMeta: Record<TaskType, { icon: LucideIcon; color: string }> = {
  normal: { icon: Star, color: 'var(--color-fg-3)' },
  percent: { icon: Percent, color: 'var(--accent)' },
  numeric: { icon: Target, color: 'var(--accent)' },
  subtasks: { icon: ListTree, color: 'var(--accent)' },
  time: { icon: Timer, color: 'var(--color-blue)' },
  habit: { icon: Flame, color: 'var(--color-amber)' },
  counter: { icon: Hash, color: 'var(--color-swatch-gold)' },
  stages: { icon: Rocket, color: 'var(--accent)' },
  collab: { icon: Users, color: 'var(--color-swatch-ice)' },
  abstain: { icon: ShieldCheck, color: 'var(--color-swatch-steel)' },
  chain: { icon: Route, color: 'var(--accent)' },
};
