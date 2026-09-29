'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { Profile } from '@/features/account/queries';
import { levelProgress, tierRoman } from '@/lib/domain/levels';
import { cn } from '@/lib/utils/cn';

/**
 * Level, experience and rank as instrument readings, with a 1 px line for
 * the way to the next level.
 */
export function LevelReadings({ profile, className }: { profile: Profile; className?: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const lp = levelProgress(profile.xp);
  const readings = [
    { key: 'level', label: t('profile.readings.level'), value: String(lp.level) },
    {
      key: 'xp',
      label: t('profile.readings.xp'),
      value:
        lp.nextLevelAt === null
          ? t('profile.maxLevel')
          : t('profile.xpOf', { xp: format.number(lp.xp), next: format.number(lp.nextLevelAt) }),
    },
    {
      key: 'rank',
      label: t('profile.readings.rank'),
      value: `${t(`ranks.${lp.rank}`)} ${tierRoman(lp.tier)}`,
    },
  ];
  return (
    <div className={cn('flex flex-col', className)}>
      <dl className="grid grid-cols-[auto_1fr_auto] border-t border-line sm:grid-cols-3">
        {readings.map((r) => (
          <div key={r.key} className="border-line pt-3 pr-4 not-first:border-l not-first:pl-4">
            <dt className="label-mono">{r.label}</dt>
            <dd
              className={cn(
                'mt-1 font-mono tabular text-fg',
                r.key === 'level' ? 'text-2xl leading-8' : 'text-sm leading-8 whitespace-nowrap',
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div
        role="progressbar"
        aria-label={t('profile.readings.xp')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(lp.progress * 100)}
        className="mt-3 h-px w-full bg-surface-5"
      >
        <div className="h-full bg-accent" style={{ width: `${lp.progress * 100}%` }} />
      </div>
    </div>
  );
}

export function rankLabel(t: (key: string) => string, xp: number) {
  const lp = levelProgress(xp);
  return `${t(`ranks.${lp.rank}`)} ${tierRoman(lp.tier)}`;
}
