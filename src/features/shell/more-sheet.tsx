'use client';

import { Ellipsis, LogOut, Orbit, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { AstronautIcon } from '@/components/brand/icons';
import { Sheet } from '@/components/ui/sheet';
import { Planet } from '@/features/cinema/planet/planet';
import { projectForest } from '@/features/projects/stats';
import { useCatalog } from '@/features/tasks/data/hooks';
import { Link, usePathname } from '@/i18n/navigation';
import type { Section } from '@/lib/domain/sections';
import { cn } from '@/lib/utils/cn';
import { isActive, phoneTabs, phoneTabsAfter, sectionItems } from './nav';
import { useSafeSignOut } from './use-safe-sign-out';

const rowClass =
  'focus-ring relative flex h-11 items-center gap-3 rounded-xs px-3 text-md text-fg transition-colors hover-ok:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-0 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.5 aria-[current=page]:before:bg-accent';

/** Phone "More": the lists that do not fit in the bottom bar, projects and the account. */
export function MoreSheet({ counts }: { counts: Record<Section, number> | null }) {
  const t = useTranslations();
  const pathname = usePathname();
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const signOut = useSafeSignOut();
  const rest = sectionItems.filter((i) => !phoneTabs.includes(i.section) && !phoneTabsAfter.includes(i.section));
  const inside =
    rest.some((i) => isActive(pathname, i.href)) ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/profile');
  const close = () => setOpen(false);

  return (
    <>
      {signOut.dialog}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('nav.more')}
        trigger={
          <button
            type="button"
            className={cn(
              'focus-ring flex flex-1 flex-col items-center justify-center gap-1 rounded-xs font-mono text-[0.625rem] tracking-[0.06em] uppercase transition-colors',
              inside ? 'text-fg [&_svg]:text-accent' : 'text-fg-3',
            )}
          >
            <span className="relative">
              <Ellipsis aria-hidden className="size-5" />
              {(counts?.overdue ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-danger" />
              )}
            </span>
            {t('nav.more')}
          </button>
        }
      >
        <nav aria-label={t('nav.sections')} className="flex flex-col gap-1 pb-2">
          {rest.map((item) => {
            const Icon = item.icon;
            const count = counts?.[item.section] ?? 0;
            return (
              <Link
                key={item.section}
                href={item.href}
                onClick={close}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={rowClass}
              >
                <Icon aria-hidden className="size-4 text-fg-3" />
                <span className="flex-1">{t(`nav.${item.section}`)}</span>
                {item.count && count > 0 && (
                  <span className={cn('font-mono text-sm tabular', item.count === 'alert' ? 'text-danger' : 'text-fg-3')}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}

          <h2 className="label-mono mt-4 px-3 pb-1">{t('nav.projects')}</h2>
          <Link href="/projects" onClick={close} aria-current={pathname === '/projects' ? 'page' : undefined} className={rowClass}>
            <Orbit aria-hidden className="size-4 text-fg-3" />
            <span className="flex-1">{t('projects.all')}</span>
          </Link>
          {catalog &&
            projectForest(catalog.projects).flatMap(function flat(node): ReactNode[] {
              const href = `/projects/${node.project.id}`;
              return [
                <Link
                  key={node.project.id}
                  href={href}
                  onClick={close}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  className={rowClass}
                  style={{ paddingLeft: 12 + Math.min(node.depth, 3) * 16 }}
                >
                  <Planet seed={node.project.planet_seed} color={node.project.color} size={16} />
                  <span className="flex-1 truncate">{node.project.name}</span>
                </Link>,
                ...node.children.flatMap(flat),
              ];
            })}

          <div className="my-3 h-px bg-line" />
          <Link href="/profile" onClick={close} aria-current={isActive(pathname, '/profile') ? 'page' : undefined} className={rowClass}>
            <AstronautIcon aria-hidden className="size-4 text-fg-3" />
            {t('shell.profile')}
          </Link>
          <Link href="/settings" onClick={close} aria-current={isActive(pathname, '/settings') ? 'page' : undefined} className={rowClass}>
            <Settings2 aria-hidden className="size-4 text-fg-3" />
            {t('shell.settings')}
          </Link>
          <button
            type="button"
            className={cn(rowClass, 'text-left')}
            onClick={() => {
              close();
              void signOut.request();
            }}
          >
            <LogOut aria-hidden className="size-4 text-fg-3" />
            {t('shell.signOut')}
          </button>
        </nav>
      </Sheet>
    </>
  );
}
