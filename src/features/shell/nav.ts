import type { ComponentType, SVGProps } from 'react';
import { CalendarClock, CalendarRange, CircleCheckBig, Inbox, Sun, Sunrise, Trash2 } from 'lucide-react';
import type { Section } from '@/lib/domain/sections';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface SectionItem {
  section: Section;
  href: `/${Section}`;
  icon: Icon;
  /** How the count reads: an alert (overdue), a normal count, or none. */
  count: 'alert' | 'normal' | 'muted' | null;
}

/** Task lists in the order of the 1–7 shortcuts. */
export const sectionItems: SectionItem[] = [
  { section: 'inbox', href: '/inbox', icon: Inbox, count: 'normal' },
  { section: 'today', href: '/today', icon: Sun, count: 'normal' },
  { section: 'tomorrow', href: '/tomorrow', icon: Sunrise, count: 'muted' },
  { section: 'week', href: '/week', icon: CalendarRange, count: 'muted' },
  { section: 'overdue', href: '/overdue', icon: CalendarClock, count: 'alert' },
  { section: 'completed', href: '/completed', icon: CircleCheckBig, count: null },
  { section: 'trash', href: '/trash', icon: Trash2, count: null },
];

/** The phone bottom bar: two lists, "+", one more list, "More". */
export const phoneTabs: Section[] = ['today', 'inbox'];
export const phoneTabsAfter: Section[] = ['week'];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
