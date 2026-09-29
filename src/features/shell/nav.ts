import type { ComponentType, SVGProps } from 'react';
import { Settings2 } from 'lucide-react';
import { AstronautIcon } from '@/components/brand/icons';

export interface NavItem {
  href: string;
  /** Key under the `shell` namespace. */
  label: 'profile' | 'settings';
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
  /** Show in the phone bottom bar. */
  mobile: boolean;
}

/** Main navigation. Task sections join in stage 3. */
export const navItems: NavItem[] = [
  { href: '/profile', label: 'profile', icon: AstronautIcon, mobile: true },
  { href: '/settings', label: 'settings', icon: Settings2, mobile: true },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
