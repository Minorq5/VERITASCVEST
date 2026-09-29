'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { RecurrenceRule } from '@/lib/domain/recurrence';
import type { PlannerPrefs } from '../data/hooks';
import { describeRecurrence } from '../format';

/** Arrays kept in the messages (weekday forms, examples) are read raw. */
export function useRawMessage<T>(namespace: 'tasks', key: string): T {
  const t = useTranslations(namespace);
  return (t.raw as unknown as (k: string) => T)(key);
}

/** "Каждую неделю: пн, ср" in the interface language. */
export function useDescribeRecurrence(prefs: Pick<PlannerPrefs, 'locale' | 'weekStart'>) {
  const t = useTranslations('tasks');
  const weekdaysAcc = useRawMessage<string[]>('tasks', 'recurrence.weekdaysAcc');
  const weekdayGender = useRawMessage<string[]>('tasks', 'recurrence.weekdayGender');
  return useCallback(
    (rule: RecurrenceRule) => describeRecurrence(rule, { t, weekdaysAcc, weekdayGender, locale: prefs.locale, weekStart: prefs.weekStart }),
    [t, weekdaysAcc, weekdayGender, prefs.locale, prefs.weekStart],
  );
}
