'use client';

import { CalendarDays } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { RankIcon } from '@/components/brand/icons';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { useProfile } from '@/features/account/queries';
import { levelProgress, tierRoman } from '@/lib/domain/levels';
import { AvatarEditor } from './avatar-editor';
import { FriendCard } from './friend-card';
import { LevelRing } from './level-card';
import { ProfileForm } from './profile-form';

export function ProfileView() {
  const t = useTranslations();
  const format = useFormatter();
  const { data: profile } = useProfile();

  if (!profile) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton className="h-52 rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  const lp = levelProgress(profile.xp);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">{t('profile.title')}</h1>
      <Surface tone="glass" spotlight className="overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--accent) 22%, transparent), transparent)' }}
        />
        <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
          <AvatarEditor profile={profile} />
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
            <p className="font-display text-3xl leading-tight font-semibold break-words text-fg">{profile.display_name}</p>
            <p className="font-mono text-base text-fg-3">@{profile.username}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge tone="accent">
                <RankIcon aria-hidden />
                {t(`ranks.${lp.rank}`)} {tierRoman(lp.tier)}
              </Badge>
              <Badge>
                <CalendarDays aria-hidden />
                {t('profile.memberSince', { date: format.dateTime(new Date(profile.created_at), { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </Badge>
            </div>
            {profile.bio && <p className="mt-2 max-w-prose text-base whitespace-pre-line text-fg-2">{profile.bio}</p>}
          </div>
          <LevelRing profile={profile} />
        </div>
      </Surface>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <ProfileForm profile={profile} />
        <FriendCard profile={profile} />
      </div>
    </div>
  );
}
