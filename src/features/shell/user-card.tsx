'use client';

import { ChevronsUpDown, LogOut, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AstronautIcon } from '@/components/brand/icons';
import { Avatar } from '@/components/ui/avatar';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ProgressBar } from '@/components/ui/progress';
import { useProfile } from '@/features/account/queries';
import { useRouter } from '@/i18n/navigation';
import { levelProgress, tierRoman } from '@/lib/domain/levels';
import { avatarUrl } from '@/lib/supabase/client';
import { useSafeSignOut } from './use-safe-sign-out';

export function UserCard() {
  const t = useTranslations();
  const router = useRouter();
  const profile = useProfile().data;
  const signOut = useSafeSignOut();
  if (!profile) return null;
  const lp = levelProgress(profile.xp);

  return (
    <>
      {signOut.dialog}
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-3 rounded-sm p-2 text-left focus-ring transition-colors hover-ok:bg-surface-2"
          >
            <Avatar name={profile.display_name} src={avatarUrl(profile.avatar_path)} size={32} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base text-fg">{profile.display_name}</span>
              <span className="truncate font-mono text-[0.6875rem] tracking-[0.04em] text-fg-3 uppercase">
                {t('profile.level', { level: lp.level })} · {t(`ranks.${lp.rank}`)}{' '}
                {tierRoman(lp.tier)}
              </span>
              <ProgressBar
                value={lp.progress}
                className="mt-1.5"
                label={t('profile.toNext', { xp: (lp.nextLevelAt ?? lp.xp) - lp.xp })}
              />
            </span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-fg-3" />
          </button>
        </MenuTrigger>
        <MenuContent
          side="top"
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-60"
        >
          <MenuItem icon={<AstronautIcon />} onSelect={() => router.push('/profile')}>
            {t('shell.profile')}
          </MenuItem>
          <MenuItem icon={<Settings2 />} onSelect={() => router.push('/settings')}>
            {t('shell.settings')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut />} onSelect={() => void signOut.request()}>
            {t('shell.signOut')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  );
}
