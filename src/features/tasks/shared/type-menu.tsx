'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { taskTypes, type TaskType } from '@/lib/domain/task-types';
import { typeMeta } from './type-meta';

/** The 11 task types with their icons and one-line descriptions. */
export function TypeMenu({
  value,
  onChange,
  trigger,
  align = 'start',
}: {
  value: TaskType;
  onChange: (type: TaskType) => void;
  trigger: ReactNode;
  align?: 'start' | 'end';
}) {
  const t = useTranslations('tasks.types');
  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align={align} className="max-h-[min(var(--radix-dropdown-menu-content-available-height),560px)] w-80">
        <MenuRadioGroup value={value} onValueChange={(v) => onChange(v as TaskType)}>
          {taskTypes.map((type) => {
            const { icon: Icon, color } = typeMeta[type];
            return (
              <MenuRadioItem key={type} value={type} className="h-auto py-2">
                <span className="flex items-start gap-3">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0" style={{ color }} />
                  <span className="flex flex-col">
                    <span className="text-base text-fg">{t(`${type}.name`)}</span>
                    <span className="text-sm text-fg-3">{t(`${type}.text`)}</span>
                  </span>
                </span>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
