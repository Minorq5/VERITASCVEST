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
import { signOut } from './sign-out';

export function UserCard() {
  const t = useTranslations();
  const router = useRouter();
  const profile = useProfile().data;
  if (!profile) return null;
  const lp = levelProgress(profile.xp);

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="focus-ring group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover-ok:bg-surface-3"
        >
          <Avatar name={profile.display_name} src={avatarUrl(profile.avatar_path)} size={40} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-medium text-fg">{profile.display_name}</span>
            <span className="truncate text-sm text-fg-3">
              {t('profile.level', { level: lp.level })} · {t(`ranks.${lp.rank}`)} {tierRoman(lp.tier)}
            </span>
            <ProgressBar value={lp.progress} className="mt-1.5 h-1" label={t('profile.toNext', { xp: (lp.nextLevelAt ?? lp.xp) - lp.xp })} />
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-fg-3" />
        </button>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-60">
        <MenuItem icon={<AstronautIcon />} onSelect={() => router.push('/profile')}>
          {t('shell.profile')}
        </MenuItem>
        <MenuItem icon={<Settings2 />} onSelect={() => router.push('/settings')}>
          {t('shell.settings')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut />}
          onSelect={() => {
            void signOut().then(() => router.replace('/login'));
          }}
        >
          {t('shell.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
