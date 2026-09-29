'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { Avatar } from '@/components/ui/avatar';
import { useProfile } from '@/features/account/queries';
import { Link, usePathname } from '@/i18n/navigation';
import { APP_HOME } from '@/lib/config/routes';
import { spring } from '@/lib/motion/tokens';
import { avatarUrl } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { isActive, navItems } from './nav';
import { UserCard } from './user-card';

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const profile = useProfile().data;

  return (
    <>
      <SpaceBackdrop intensity={0.55} />

      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-[var(--z-sticky)] hidden w-68 flex-col border-r border-line lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={APP_HOME} className="focus-ring rounded-md">
            <LogoLockup size="sm" />
          </Link>
        </div>
        <nav aria-label={t('navigation')} className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'focus-ring relative flex h-10 items-center gap-3 rounded-md px-3 text-base transition-colors duration-150',
                      active ? 'bg-surface-3 text-fg' : 'text-fg-2 hover-ok:bg-surface-3/60 hover-ok:text-fg',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        transition={spring.snappy}
                        className="absolute left-0 h-5 w-0.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
                      />
                    )}
                    <Icon aria-hidden className={cn('size-[18px]', active && 'text-accent')} />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line p-3">
          <UserCard />
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="glass-strong sticky top-0 z-[var(--z-sticky)] flex h-14 items-center justify-between border-b border-line px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Link href={APP_HOME} className="focus-ring rounded-md" aria-label="Veritas Tasks">
          <LogoLockup size="sm" />
        </Link>
        {profile && (
          <Link href="/profile" className="focus-ring rounded-full" aria-label={t('profile')}>
            <Avatar name={profile.display_name} src={avatarUrl(profile.avatar_path)} size={32} />
          </Link>
        )}
      </header>

      <div className="lg:pl-68">
        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      {/* Phone bottom navigation */}
      <nav
        aria-label={t('navigation')}
        className="glass-strong fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
          {navItems
            .filter((item) => item.mobile)
            .map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className="flex flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'focus-ring relative flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors',
                      active ? 'text-accent' : 'text-fg-3',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="bottom-active"
                        transition={spring.snappy}
                        className="absolute top-0 h-0.5 w-8 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
                      />
                    )}
                    <Icon aria-hidden className="size-[22px]" />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>
    </>
  );
}
