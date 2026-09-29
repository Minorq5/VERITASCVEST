import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { describeRecurrence, formatDuration, formatStopwatch, nextWeekStart, relativeDay, thisWeekend } from '@/features/tasks/format';
import { presets } from '@/lib/domain/recurrence';
import bg from '@/messages/bg.json';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

const all = { ru, en, bg } as const;

/** Messages glue short words with no-break spaces; compare the words. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

function words(locale: keyof typeof all) {
  const messages = all[locale];
  const t = createTranslator({ locale, messages, namespace: 'tasks' });
  return {
    t,
    weekdaysAcc: messages.tasks.recurrence.weekdaysAcc,
    weekdayGender: messages.tasks.recurrence.weekdayGender,
    locale,
    weekStart: 1,
  };
}

describe('repeat rules in words', () => {
  it('Russian: weekdays, the nth weekday with the right gender, "from completion"', () => {
    const w = words('ru');
    expect(plain(describeRecurrence(presets.weekdays('2026-09-28'), w))).toBe('По будням');
    expect(plain(describeRecurrence(presets.weekly('2026-09-28', [3, 1]), w))).toBe('Каждую неделю: пн, ср');
    expect(plain(describeRecurrence(presets.monthlyNth('2026-10-13', 2, 2), w))).toBe('Каждый месяц, во второй вторник');
    expect(plain(describeRecurrence(presets.monthlyNth('2026-10-30', 5, -1), w))).toBe('Каждый месяц, в последнюю пятницу');
    expect(plain(describeRecurrence(presets.monthlyNth('2026-10-04', 0, 1), w))).toBe('Каждый месяц, в первое воскресенье');
    expect(plain(describeRecurrence(presets.monthlyOnDay('2026-10-15', 15), w))).toBe('Каждый месяц, 15-го числа');
    expect(plain(describeRecurrence(presets.monthlyOnDay('2026-10-31', -1), w))).toBe('Каждый месяц, в последний день');
    expect(plain(describeRecurrence({ ...presets.daily('2026-09-28', 3), mode: 'completion' }, w))).toBe('Через 3 дня после выполнения');
    expect(plain(describeRecurrence(presets.daily('2026-09-28', 2), w))).toBe('Каждые 2 дня');
    expect(plain(describeRecurrence({ ...presets.daily('2026-09-28'), count: 5 }, w))).toBe('Каждый день, 5 раз');
  });

  it('Bulgarian and English', () => {
    expect(plain(describeRecurrence(presets.monthlyNth('2026-10-21', 3, 3), words('bg')))).toBe('Всеки месец, в третата сряда');
    expect(plain(describeRecurrence(presets.weekly('2026-09-28', [1, 3], 2), words('en')))).toBe('Every 2 weeks: Mon, Wed');
    expect(plain(describeRecurrence(presets.monthlyNth('2026-10-30', 5, -1), words('en')))).toBe('Every month on the last Friday');
  });
});

describe('dates and durations', () => {
  const t = createTranslator({ locale: 'ru', messages: ru, namespace: 'tasks' });

  it('relative days', () => {
    expect(relativeDay('2026-09-29', '2026-09-29', 'ru', t)).toBe('Сегодня');
    expect(relativeDay('2026-09-30', '2026-09-29', 'ru', t)).toBe('Завтра');
    expect(relativeDay('2026-09-28', '2026-09-29', 'ru', t)).toBe('Вчера');
    expect(relativeDay('2026-10-02', '2026-09-29', 'ru', t)).toBe('Пятница');
    expect(relativeDay('2026-10-12', '2026-09-29', 'ru', t)).toBe('12 окт');
    expect(relativeDay('2027-01-05', '2026-09-29', 'ru', t)).toBe('5 янв. 2027');
  });

  it('durations and the stopwatch', () => {
    expect(formatDuration(45, t)).toBe('45 мин');
    expect(formatDuration(120, t)).toBe('2 ч');
    expect(formatDuration(95, t)).toBe('1 ч 35 мин');
    expect(formatStopwatch(65)).toBe('1:05');
    expect(formatStopwatch(3725)).toBe('1:02:05');
  });

  it('next week and the weekend', () => {
    // 2026-09-29 is a Tuesday.
    expect(nextWeekStart('2026-09-29', 1)).toBe('2026-10-05');
    expect(nextWeekStart('2026-09-29', 0)).toBe('2026-10-04');
    expect(nextWeekStart('2026-10-05', 1)).toBe('2026-10-12');
    expect(thisWeekend('2026-09-29')).toBe('2026-10-03');
    expect(thisWeekend('2026-10-04')).toBe('2026-10-04');
  });
});
