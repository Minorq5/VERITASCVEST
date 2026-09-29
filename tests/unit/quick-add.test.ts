import { describe, expect, it } from 'vitest';
import { parseQuickAdd, type QuickAddContext } from '@/lib/domain/quick-add/parse';

// Wednesday 30 September 2026, 15:30; weeks start on Monday.
const base = { today: '2026-09-30', nowTime: '15:30', weekStart: 1 } as const;
const ru = (text: string, extra: Partial<QuickAddContext> = {}) => parseQuickAdd(text, { ...base, locale: 'ru', ...extra });
const en = (text: string) => parseQuickAdd(text, { ...base, locale: 'en' });
const bg = (text: string) => parseQuickAdd(text, { ...base, locale: 'bg' });

describe('smart input: Russian', () => {
  it('the example from the brief', () => {
    const r = ru('Сходить в зал завтра в 18:00 #спорт !высокий');
    expect(r).toMatchObject({ title: 'Сходить в зал', dueDate: '2026-10-01', dueTime: '18:00', tags: ['спорт'], priority: 'high' });
    expect(r.tokens.map((t) => t.kind)).toEqual(['date', 'time', 'tag', 'priority']);
  });

  it('weekdays in every form', () => {
    expect(ru('Позвонить маме в пятницу')).toMatchObject({ title: 'Позвонить маме', dueDate: '2026-10-02' });
    expect(ru('Отчёт до пятницы')).toMatchObject({ title: 'Отчёт', dueDate: '2026-10-02' });
    expect(ru('Отправить письмо к пятнице')).toMatchObject({ title: 'Отправить письмо', dueDate: '2026-10-02' });
    expect(ru('Созвон в следующую среду')).toMatchObject({ title: 'Созвон', dueDate: '2026-10-07' });
    expect(ru('Сегодня в среду вечеринка').dueDate).toBe('2026-09-30');
  });

  it('start and due: "с понедельника до пятницы"', () => {
    const r = ru('Ремонт с понедельника до пятницы');
    expect(r).toMatchObject({ title: 'Ремонт', startDate: '2026-10-05', dueDate: '2026-10-09' });
    expect(r.tokens.map((t) => t.kind)).toEqual(['start', 'due']);
  });

  it('dates with month names and numbers', () => {
    expect(ru('Встреча 15 марта в 10:00')).toMatchObject({ title: 'Встреча', dueDate: '2027-03-15', dueTime: '10:00' });
    expect(ru('Купить молоко 15.10')).toMatchObject({ title: 'Купить молоко', dueDate: '2026-10-15' });
    expect(ru('Сдать 01.02.2027')).toMatchObject({ dueDate: '2027-02-01' });
    expect(ru('Взять 2.5 кг муки').dueDate).toBeNull();
  });

  it('relative dates', () => {
    expect(ru('Созвон через 2 недели').dueDate).toBe('2026-10-14');
    expect(ru('Созвон через неделю').dueDate).toBe('2026-10-07');
    expect(ru('Анализы через три дня').dueDate).toBe('2026-10-03');
    expect(ru('Поход на выходных')).toMatchObject({ title: 'Поход', dueDate: '2026-10-03' });
    expect(ru('План на следующей неделе')).toMatchObject({ title: 'План', dueDate: '2026-10-05' });
    expect(ru('Отпуск в следующем месяце').dueDate).toBe('2026-10-01');
    expect(ru('Сделать послезавтра').dueDate).toBe('2026-10-02');
  });

  it('times, and what is not a time', () => {
    expect(ru('Позвонить завтра утром')).toMatchObject({ dueDate: '2026-10-01', dueTime: '09:00' });
    // 15:00 has already passed at 15:30, so the bare time means tomorrow.
    expect(ru('Лекция в 3 дня')).toMatchObject({ title: 'Лекция', dueTime: '15:00', dueDate: '2026-10-01' });
    expect(ru('Ужин в 7 вечера')).toMatchObject({ dueTime: '19:00' });
    expect(ru('Позвонить в 9')).toMatchObject({ title: 'Позвонить', dueTime: '09:00', dueDate: '2026-10-01' });
    expect(ru('Позвонить в 18')).toMatchObject({ dueTime: '18:00', dueDate: '2026-09-30' });
    expect(ru('Урок в 9 классе')).toMatchObject({ title: 'Урок в 9 классе', dueTime: null });
    expect(ru('Отпуск 3 дня')).toMatchObject({ title: 'Отпуск 3 дня', dueTime: null, dueDate: null });
    expect(ru('Работа в среде разработки')).toMatchObject({ title: 'Работа в среде разработки', dueDate: null });
  });

  it('repeats', () => {
    const daily = ru('Выпить 8 стаканов воды каждый день');
    expect(daily).toMatchObject({ title: 'Выпить 8 стаканов воды', dueDate: '2026-09-30' });
    expect(daily.recurrence).toMatchObject({ freq: 'daily', interval: 1 });
    expect(daily.hint).toEqual({ type: 'counter', target: 8, unit: 'стаканов' });

    const yoga = ru('Йога по вторникам и четвергам в 7 утра');
    expect(yoga).toMatchObject({ title: 'Йога', dueTime: '07:00', dueDate: '2026-10-01' });
    expect(yoga.recurrence).toMatchObject({ freq: 'weekly', byWeekday: [2, 4] });

    expect(ru('Полить цветы каждые 3 дня').recurrence).toMatchObject({ freq: 'daily', interval: 3 });
    expect(ru('Отчёт каждые две недели').recurrence).toMatchObject({ freq: 'weekly', interval: 2 });
    expect(ru('Планёрка по будням').recurrence).toMatchObject({ freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] });

    const rent = ru('Оплатить квартиру каждое 15 число');
    expect(rent).toMatchObject({ title: 'Оплатить квартиру', dueDate: '2026-10-15' });
    expect(rent.recurrence).toMatchObject({ freq: 'monthly', byMonthDay: 15, anchor: '2026-10-15' });

    expect(ru('Бассейн каждый понедельник и четверг').recurrence).toMatchObject({ byWeekday: [1, 4], anchor: '2026-10-01' });
  });

  it('markers: project, assignee, estimate, reminder, priorities', () => {
    const r = ru('Купить подарок +"Дом и дача" @maria ~1ч30м напомни за 15 минут');
    expect(r).toMatchObject({ title: 'Купить подарок', project: 'Дом и дача', assignees: ['maria'], estimateMinutes: 90, reminders: [15] });
    expect(ru('Задача !1').priority).toBe('critical');
    expect(ru('Задача !4').priority).toBe('low');
    expect(ru('Сделать ~30м').estimateMinutes).toBe(30);
    expect(ru('Сделать напомнить за час').reminders).toEqual([60]);
    expect(ru('Проект +Работа').project).toBe('Работа');
  });

  it('never mistakes code or emails for markers', () => {
    expect(ru('Выучить C# и C++').tags).toEqual([]);
    expect(ru('Выучить C# и C++').project).toBeNull();
    expect(ru('Написать на mail@example.com').assignees).toEqual([]);
  });

  it('type hints leave the text in the title', () => {
    const r = ru('Прочитать 300 страниц');
    expect(r.title).toBe('Прочитать 300 страниц');
    expect(r.hint).toEqual({ type: 'numeric', target: 300, unit: 'страниц' });
  });

  it('a chip turned off stays plain text', () => {
    const first = ru('Съездить завтра');
    const key = first.tokens[0]!.key;
    const off = ru('Съездить завтра', { disabled: new Set([key]) });
    expect(off).toMatchObject({ title: 'Съездить завтра', dueDate: null });
  });

  it('English phrases work in a Russian interface too', () => {
    expect(ru('Встреча tomorrow at 6pm')).toMatchObject({ title: 'Встреча', dueDate: '2026-10-01', dueTime: '18:00' });
  });
});

describe('smart input: English', () => {
  it('parses dates, times, tags and priorities', () => {
    expect(en('Gym tomorrow at 6pm #sport !high')).toMatchObject({
      title: 'Gym', dueDate: '2026-10-01', dueTime: '18:00', tags: ['sport'], priority: 'high',
    });
    expect(en('Call mom on friday')).toMatchObject({ title: 'Call mom', dueDate: '2026-10-02' });
    expect(en('Report by friday')).toMatchObject({ title: 'Report', dueDate: '2026-10-02' });
    expect(en('Meeting next friday')).toMatchObject({ title: 'Meeting', dueDate: '2026-10-09' });
    expect(en('Trip in 3 days').dueDate).toBe('2026-10-03');
    expect(en('Dentist march 15 at 9:30am')).toMatchObject({ title: 'Dentist', dueDate: '2027-03-15', dueTime: '09:30' });
    expect(en('Lunch at noon')).toMatchObject({ title: 'Lunch', dueTime: '12:00' });
  });

  it('repeats', () => {
    expect(en('Pay rent every 1st').recurrence).toMatchObject({ freq: 'monthly', byMonthDay: 1, anchor: '2026-10-01' });
    const standup = en('Standup every weekday at 10:00');
    expect(standup).toMatchObject({ title: 'Standup', dueTime: '10:00', dueDate: '2026-09-30' });
    expect(en('Water plants every other day').recurrence).toMatchObject({ freq: 'daily', interval: 2 });
    expect(en('Review every monday and thursday').recurrence).toMatchObject({ byWeekday: [1, 4] });
  });

  it('leaves ordinary words alone', () => {
    expect(en('I sat down with the sun').dueDate).toBeNull();
    expect(en('Read 50 pages').hint).toEqual({ type: 'numeric', target: 50, unit: 'pages' });
  });
});

describe('smart input: Bulgarian', () => {
  it('parses dates, times, tags and priorities', () => {
    expect(bg('Фитнес утре в 18:00 #спорт !висок')).toMatchObject({
      title: 'Фитнес', dueDate: '2026-10-01', dueTime: '18:00', tags: ['спорт'], priority: 'high',
    });
    expect(bg('Обади се на мама в петък')).toMatchObject({ title: 'Обади се на мама', dueDate: '2026-10-02' });
    expect(bg('Отчет до петък')).toMatchObject({ title: 'Отчет', dueDate: '2026-10-02' });
    expect(bg('Среща след 2 седмици').dueDate).toBe('2026-10-14');
    expect(bg('Вечеря в 7 вечерта')).toMatchObject({ dueTime: '19:00' });
    expect(bg('Разходка през уикенда').dueDate).toBe('2026-10-03');
  });

  it('repeats', () => {
    expect(bg('Плащане всяко 15-о число').recurrence).toMatchObject({ freq: 'monthly', byMonthDay: 15 });
    expect(bg('Йога всеки вторник и четвъртък').recurrence).toMatchObject({ byWeekday: [2, 4] });
    expect(bg('Разходка всеки ден').recurrence).toMatchObject({ freq: 'daily' });
    expect(bg('Отчет на всеки 2 седмици').recurrence).toMatchObject({ freq: 'weekly', interval: 2 });
  });
});

describe('smart input: robustness', () => {
  it('never throws, never overlaps tokens, and keeps spans inside the text', async () => {
    const fc = await import('fast-check');
    const words = [
      'завтра', 'в', '18:00', 'пятницу', '#спорт', '!высокий', 'каждый', 'день', 'через', '2', 'недели', '+Дом',
      '@maria', '~30м', 'tomorrow', 'at', '6pm', 'every', 'monday', 'утре', 'петък', '15.03', 'марта', 'и', ',',
      'по', 'вторникам', 'с', 'до', 'напомни', 'за', '15', 'минут', 'текст', 'задача', '9', 'классе',
    ];
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constantFrom(...words), fc.string({ maxLength: 6 })), { maxLength: 14 }), fc.constantFrom('ru', 'en', 'bg'), (parts, locale) => {
        const text = parts.join(' ');
        const r = parseQuickAdd(text, { ...base, locale: locale as 'ru' | 'en' | 'bg' });
        let last = -1;
        for (const t of r.tokens) {
          if (t.start < 0 || t.end > text.length || t.start >= t.end) return false;
          if (text.slice(t.start, t.end) !== t.text) return false;
          if (t.start < last) return false;
          last = t.end;
        }
        return typeof r.title === 'string';
      }),
      { numRuns: 400 },
    );
  });
});
