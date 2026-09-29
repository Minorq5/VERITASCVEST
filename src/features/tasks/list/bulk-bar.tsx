'use client';

import { CalendarDays, CalendarRange, CalendarX2, CircleCheckBig, Flag, RotateCcw, Sun, Sunrise, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { priorityVar } from '@/lib/color/swatches';
import { spring } from '@/lib/motion/tokens';
import { addDays, type IsoDate } from '@/lib/time/dates';
import type { PlannerPrefs } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import { nextWeekStart, relativeDay } from '../format';
import type { RowModel } from './row-model';

/** Actions for the selected tasks, floating above the list. */
export function BulkBar({
  ids,
  rowsById,
  trash,
  today,
  prefs,
  actions,
  onPurge,
  onDone,
}: {
  ids: string[];
  rowsById: Map<string, RowModel>;
  trash: boolean;
  today: IsoDate;
  prefs: PlannerPrefs;
  actions: TaskActions;
  onPurge: (ids: string[]) => void;
  onDone: () => void;
}) {
  const t = useTranslations('tasks');
  const tasks = ids.map((id) => rowsById.get(id)?.task).filter((task) => task !== undefined);
  const setDue = async (date: IsoDate | null) => {
    await actions.setDue(ids, date, date ? relativeDay(date, today, prefs.locale, t) : t('dates.clear'));
    onDone();
  };

  return (
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div
          role="toolbar"
          aria-label={t('bulk.label')}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={spring.smooth}
          className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[var(--z-sticky)] flex justify-center px-3 lg:bottom-6 lg:pl-68"
        >
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-line-bright bg-surface-2 p-1">
            <span className="border-r border-line-strong px-3 font-mono text-xs tracking-[0.06em] whitespace-nowrap text-fg uppercase" aria-live="polite">
              {t('bulk.selected', { count: ids.length })}
            </span>
            {trash ? (
              <>
                <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void actions.restore(ids).then(onDone)}>
                  {t('bulk.restore')}
                </Button>
                <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => onPurge(ids)}>
                  {t('bulk.deleteForever')}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" icon={<CircleCheckBig />} onClick={() => void actions.completeMany(tasks).then(onDone)}>
                  <span className="max-sm:sr-only">{t('bulk.complete')}</span>
                </Button>
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="sm" variant="ghost" icon={<CalendarDays />}>
                      <span className="max-sm:sr-only">{t('bulk.date')}</span>
                    </Button>
                  </MenuTrigger>
                  <MenuContent side="top">
                    <MenuItem icon={<Sun />} onSelect={() => void setDue(today)}>
                      {t('actions.today')}
                    </MenuItem>
                    <MenuItem icon={<Sunrise />} onSelect={() => void setDue(addDays(today, 1))}>
                      {t('actions.tomorrow')}
                    </MenuItem>
                    <MenuItem icon={<CalendarRange />} onSelect={() => void setDue(nextWeekStart(today, prefs.weekStart))}>
                      {t('actions.nextWeek')}
                    </MenuItem>
                    <MenuItem icon={<CalendarX2 />} onSelect={() => void setDue(null)}>
                      {t('actions.noDate')}
                    </MenuItem>
                  </MenuContent>
                </Menu>
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="sm" variant="ghost" icon={<Flag />}>
                      <span className="max-sm:sr-only">{t('bulk.priority')}</span>
                    </Button>
                  </MenuTrigger>
                  <MenuContent side="top">
                    {(['critical', 'high', 'medium', 'low'] as const).map((key) => (
                      <MenuItem
                        key={key}
                        icon={<Flag style={{ color: priorityVar(key) }} />}
                        onSelect={() => void actions.setPriority(ids, key).then(onDone)}
                      >
                        {t(`priority.${key}`)}
                      </MenuItem>
                    ))}
                    <MenuItem onSelect={() => void actions.setPriority(ids, null).then(onDone)}>{t('priority.none')}</MenuItem>
                  </MenuContent>
                </Menu>
                <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 />} onClick={() => void actions.trash(ids).then(onDone)}>
                  <span className="max-sm:sr-only">{t('bulk.delete')}</span>
                </Button>
              </>
            )}
            <IconButton size="sm" label={t('bulk.clear')} icon={<X />} onClick={onDone} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
