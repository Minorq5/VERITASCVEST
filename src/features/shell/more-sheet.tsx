'use client';

import { Ellipsis, LogOut, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AstronautIcon } from '@/components/brand/icons';
import { Sheet } from '@/components/ui/sheet';
import { useCatalog } from '@/features/tasks/data/hooks';
import { Link, usePathname } from '@/i18n/navigation';
import { swatchVar } from '@/lib/color/swatches';
import type { Section } from '@/lib/domain/sections';
import { cn } from '@/lib/utils/cn';
import { isActive, phoneTabs, phoneTabsAfter, sectionItems } from './nav';
import { useSafeSignOut } from './use-safe-sign-out';

const rowClass =
  'focus-ring flex h-12 items-center gap-3 rounded-md px-3 text-md text-fg transition-colors hover-ok:bg-surface-3 aria-[current=page]:bg-surface-3 aria-[current=page]:text-accent';

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
    pathname.startsWith('/projects/') ||
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
              'focus-ring flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors',
              inside ? 'text-accent' : 'text-fg-3',
            )}
          >
            <span className="relative">
              <Ellipsis aria-hidden className="size-[22px]" />
              {(counts?.overdue ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-danger" />
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
                <Icon aria-hidden className="size-5 text-fg-2" />
                <span className="flex-1">{t(`nav.${item.section}`)}</span>
                {item.count && count > 0 && (
                  <span className={cn('font-mono text-sm tabular', item.count === 'alert' ? 'text-danger' : 'text-fg-3')}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}

          {catalog && catalog.projects.length > 0 && (
            <>
              <h2 className="mt-4 px-3 pb-1 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('nav.projects')}</h2>
              {catalog.projects.map((project) => {
                const href = `/projects/${project.id}`;
                return (
                  <Link
                    key={project.id}
                    href={href}
                    onClick={close}
                    aria-current={isActive(pathname, href) ? 'page' : undefined}
                    className={rowClass}
                  >
                    <span aria-hidden className="mx-1 size-3 rounded-full" style={{ background: swatchVar(project.color) }} />
                    <span className="flex-1 truncate">{project.name}</span>
                  </Link>
                );
              })}
            </>
          )}

          <div className="my-3 h-px bg-line" />
          <Link href="/profile" onClick={close} aria-current={isActive(pathname, '/profile') ? 'page' : undefined} className={rowClass}>
            <AstronautIcon aria-hidden className="size-5 text-fg-2" />
            {t('shell.profile')}
          </Link>
          <Link href="/settings" onClick={close} aria-current={isActive(pathname, '/settings') ? 'page' : undefined} className={rowClass}>
            <Settings2 aria-hidden className="size-5 text-fg-2" />
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
            <LogOut aria-hidden className="size-5 text-fg-2" />
            {t('shell.signOut')}
          </button>
        </nav>
      </Sheet>
    </>
  );
}
