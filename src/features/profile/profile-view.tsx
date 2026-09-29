'use client';

import { CalendarDays } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/features/account/queries';
import { AvatarEditor } from './avatar-editor';
import { FriendCard } from './friend-card';
import { LevelReadings } from './level-card';
import { ProfileForm } from './profile-form';

/**
 * The profile as an instrument page: who you are on the left, your readings
 * (level, experience, rank) on the right, then editing and the friend code.
 */
export function ProfileView() {
  const t = useTranslations();
  const format = useFormatter();
  const { data: profile } = useProfile();

  if (!profile) {
    return (
      <div className="flex flex-col gap-8" aria-busy>
        <Skeleton className="h-36 rounded-md" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96 rounded-md" />
          <Skeleton className="h-80 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">{t('profile.title')}</h1>
      <header className="flex flex-col gap-6 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex min-w-0 items-center gap-5">
          <AvatarEditor profile={profile} size={88} />
          <div className="min-w-0">
            <p className="font-display text-3xl leading-tight font-medium tracking-[-0.02em] break-words text-fg">
              {profile.display_name}
            </p>
            <p className="mt-1 font-mono text-sm text-fg-3">@{profile.username}</p>
            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.06em] text-fg-3 uppercase">
              <CalendarDays aria-hidden className="size-3.5" />
              {t('profile.memberSince', {
                date: format.dateTime(new Date(profile.created_at), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          </div>
        </div>
        <LevelReadings profile={profile} className="w-full lg:max-w-md" />
      </header>
      {profile.bio && (
        <p className="-mt-2 max-w-prose text-base whitespace-pre-line text-fg-2">{profile.bio}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <ProfileForm profile={profile} />
        <FriendCard profile={profile} />
      </div>
    </div>
  );
}
