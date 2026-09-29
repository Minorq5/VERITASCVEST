'use client';

import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { LogoLockup } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { Avatar } from '@/components/ui/avatar';
import { Kbd } from '@/components/ui/kbd';
import { useProfile } from '@/features/account/queries';
import { SyncBadge, SyncIndicator } from '@/features/sync/sync-indicator';
import { useCatalog, useTasks } from '@/features/tasks/data/hooks';
import { useTrashSweep } from '@/features/tasks/data/use-trash-sweep';
import { TaskPanel } from '@/features/tasks/detail/task-panel';
import { QuickAddDialog } from '@/features/tasks/quick-add/quick-add-dialog';
import { useQuickAdd } from '@/features/tasks/quick-add/store';
import { Link, usePathname } from '@/i18n/navigation';
import { APP_HOME } from '@/lib/config/routes';
import { swatchVar } from '@/lib/color/swatches';
import type { Section } from '@/lib/domain/sections';
import { spring } from '@/lib/motion/tokens';
import { avatarUrl } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { ShellHotkeys } from './hotkeys';
import { MoreSheet } from './more-sheet';
import { isActive, phoneTabs, phoneTabsAfter, sectionItems } from './nav';
import { useSectionCounts } from './use-section-counts';
import { UserCard } from './user-card';

function NavCount({ value, kind }: { value: number; kind: 'alert' | 'normal' | 'muted' | null }) {
  if (!kind || value <= 0) return null;
  return (
    <span
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-xs font-medium tabular',
        kind === 'alert' && 'bg-danger/15 text-danger',
        kind === 'normal' && 'bg-surface-4 text-fg-2',
        kind === 'muted' && 'text-fg-3',
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  children,
  trailing,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-ring relative flex h-9 items-center gap-3 rounded-md px-3 text-base transition-colors duration-150',
        active ? 'bg-surface-3 text-fg' : 'text-fg-2 hover-ok:bg-surface-3/60 hover-ok:text-fg',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={spring.snappy}
          className="absolute left-0 h-5 w-0.5 rounded-full bg-accent"
        />
      )}
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}

function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const counts = useSectionCounts();
  const catalog = useCatalog();
  const tasks = useTasks();
  const openQuickAdd = useQuickAdd((s) => s.setOpen);

  const projectCounts = new Map<string, number>();
  for (const task of tasks ?? []) {
    if (task.project_id && !task.parent_id && !task.completed_at && !task.deleted_at) {
      projectCounts.set(task.project_id, (projectCounts.get(task.project_id) ?? 0) + 1);
    }
  }

  return (
    <aside className="bg-surface-1 fixed inset-y-0 left-0 z-[var(--z-sticky)] hidden w-68 flex-col border-r border-line lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href={APP_HOME} className="focus-ring rounded-md">
          <LogoLockup size="sm" />
        </Link>
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={() => openQuickAdd(true)}
          className={cn(
            'focus-ring group flex h-10 w-full items-center gap-3 rounded-md border border-line-strong px-3 text-base text-fg bg-surface-1',
            'transition-[border-color,box-shadow] duration-200 hover-ok:border-[color-mix(in_oklab,var(--accent)_45%,transparent)]',
          )}
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Plus aria-hidden className="size-3.5" strokeWidth={2.5} />
          </span>
          <span className="flex-1 text-left">{t('nav.newTask')}</span>
          <Kbd>N</Kbd>
        </button>
      </div>
      <nav aria-label={t('shell.navigation')} className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {sectionItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.section}>
                <SidebarLink
                  href={item.href}
                  active={active}
                  icon={<Icon aria-hidden className={cn('size-[18px] shrink-0', active && 'text-accent')} />}
                  trailing={counts && <NavCount value={counts[item.section]} kind={item.count} />}
                >
                  {t(`nav.${item.section}`)}
                </SidebarLink>
              </li>
            );
          })}
        </ul>

        {catalog && catalog.projects.length > 0 && (
          <div className="mt-6">
            <h2 className="px-3 pb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('nav.projects')}</h2>
            <ul className="flex flex-col gap-0.5">
              {catalog.projects.map((project) => {
                const href = `/projects/${project.id}`;
                return (
                  <li key={project.id}>
                    <SidebarLink
                      href={href}
                      active={isActive(pathname, href)}
                      icon={
                        <span
                          aria-hidden
                          className="mx-1 size-2 shrink-0 rounded-full"
                          style={{ background: swatchVar(project.color) }}
                        />
                      }
                      trailing={<NavCount value={projectCounts.get(project.id) ?? 0} kind="muted" />}
                    >
                      {project.name}
                    </SidebarLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
      <div className="border-t border-line px-3 pt-3">
        <SyncIndicator />
      </div>
      <div className="p-3">
        <UserCard />
      </div>
    </aside>
  );
}

function PhoneTab({ section, active, count }: { section: Section; active: boolean; count: number }) {
  const t = useTranslations('nav');
  const item = sectionItems.find((i) => i.section === section)!;
  const Icon = item.icon;
  return (
    <li className="flex flex-1">
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
            className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
          />
        )}
        <span className="relative">
          <Icon aria-hidden className="size-[22px]" />
          {count > 0 && item.count === 'normal' && (
            <span className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold text-accent-ink">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </span>
        {t(section)}
      </Link>
    </li>
  );
}

function PhoneNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const counts = useSectionCounts();
  const openQuickAdd = useQuickAdd((s) => s.setOpen);
  const tab = (section: Section) => (
    <PhoneTab key={section} section={section} active={isActive(pathname, `/${section}`)} count={counts?.[section] ?? 0} />
  );
  return (
    <nav
      aria-label={t('sections')}
      className="bg-surface-1 fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
        {phoneTabs.map(tab)}
        <li className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openQuickAdd(true)}
            aria-label={t('newTask')}
            className={cn(
              'focus-ring inline-flex size-11 items-center justify-center rounded-md bg-accent text-accent-ink',
              'transition-colors active:bg-accent-lo',
            )}
          >
            <Plus aria-hidden className="size-5" strokeWidth={2} />
          </button>
        </li>
        {phoneTabsAfter.map(tab)}
        <li className="flex flex-1">
          <MoreSheet counts={counts} />
        </li>
      </ul>
    </nav>
  );
}

/** The main column makes room for the docked task panel on wide screens. */
function MainColumn({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const panelOpen = Boolean(params.get('task'));
  return (
    <div className={cn('transition-[padding] duration-300 lg:pl-68', panelOpen && 'xl:pr-[var(--panel-w)]')}>
      <main
        id="main"
        className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16"
      >
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('shell');
  const profile = useProfile().data;
  useTrashSweep();

  return (
    <div className="[--panel-w:28rem] 2xl:[--panel-w:32rem]">
      <SpaceBackdrop intensity={0.55} />
      <Sidebar />

      {/* Phone top bar */}
      <header className="bg-surface-1 sticky top-0 z-[var(--z-sticky)] flex h-14 items-center justify-between border-b border-line px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Link href={APP_HOME} className="focus-ring rounded-md" aria-label="Veritas Tasks">
          <LogoLockup size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <SyncBadge />
          {profile && (
            <Link href="/profile" className="focus-ring rounded-full" aria-label={t('profile')}>
              <Avatar name={profile.display_name} src={avatarUrl(profile.avatar_path)} size={32} />
            </Link>
          )}
        </div>
      </header>

      <Suspense fallback={<MainColumnStatic>{children}</MainColumnStatic>}>
        <MainColumn>{children}</MainColumn>
        <TaskPanel />
      </Suspense>

      <PhoneNav />
      <QuickAddDialog />
      <ShellHotkeys />
    </div>
  );
}

function MainColumnStatic({ children }: { children: ReactNode }) {
  return (
    <div className="lg:pl-68">
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
