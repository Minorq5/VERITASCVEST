'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { ProgressRing } from '@/components/ui/progress';
import type { Profile } from '@/features/account/queries';
import { levelProgress, tierRoman } from '@/lib/domain/levels';

/** Level, rank and progress to the next level. XP starts flowing in stage 3. */
export function LevelRing({ profile, size = 132 }: { profile: Profile; size?: number }) {
  const t = useTranslations('profile');
  const format = useFormatter();
  const lp = levelProgress(profile.xp);
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <ProgressRing value={lp.progress} size={size}>
        <span className="flex flex-col items-center leading-none">
          <span className="font-display text-4xl font-semibold text-fg tabular">{lp.level}</span>
          <span className="eyebrow mt-1.5 text-[10px]">{t('levelShort')}</span>
        </span>
      </ProgressRing>
      <p className="font-mono text-sm text-fg-3 tabular">
        {lp.nextLevelAt === null
          ? t('maxLevel')
          : t('xpOf', { xp: format.number(lp.xp), next: format.number(lp.nextLevelAt) })}
      </p>
    </div>
  );
}

export function rankLabel(t: (key: string) => string, xp: number) {
  const lp = levelProgress(xp);
  return `${t(`ranks.${lp.rank}`)} ${tierRoman(lp.tier)}`;
}
