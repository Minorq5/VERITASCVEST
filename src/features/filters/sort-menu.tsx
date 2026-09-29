'use client';

import { ArrowDownUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { isSortMode } from '@/lib/domain/sort';
import type { ListSort } from './use-list-sort';

/** "Sort: by deadline" — the order of the list on screen. */
export function SortMenu({ sort }: { sort: ListSort }) {
  const t = useTranslations('sort');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="sm" variant="ghost" icon={<ArrowDownUp />} aria-label={`${t('label')}: ${t(`modes.${sort.mode}`)}`}>
          <span className="max-sm:sr-only">{t(`modes.${sort.mode}`)}</span>
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{t('label')}</MenuLabel>
        <MenuRadioGroup value={sort.mode} onValueChange={(v) => isSortMode(v) && sort.setMode(v)}>
          {sort.modes.map((mode) => (
            <MenuRadioItem key={mode} value={mode}>
              {t(`modes.${mode}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
