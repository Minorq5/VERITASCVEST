/**
 * Words the smart input understands, per language. Weekday index: 0 Sunday … 6 Saturday.
 * Russian and Bulgarian list the grammatical forms people actually type
 * ("в пятницу", "до пятницы", "по пятницам").
 */
export type QuickLocale = 'ru' | 'en' | 'bg';

export interface Lexicon {
  /** Forms of each weekday (index 0–6) usable as "on that day". */
  weekdays: string[][];
  /** "по понедельникам" style plurals (Russian). */
  weekdayPlurals?: string[][];
  /** "к пятнице" (Russian dative, only after "к": "в среде" is not Wednesday). */
  weekdaysDative?: string[][];
  /** Month names (index 0 = January), all forms. */
  months: string[][];
  numberWords: Record<string, number>;
  today: string[];
  tomorrow: string[];
  afterTomorrow: string[];
  /** Words that introduce a weekday or date: "в", "on". */
  onWords: string[];
  nextWords: string[];
  /** "in 3 days" / "через 3 дня" / "след 3 дни". */
  inWords: string[];
  unitDay: string[];
  unitWeek: string[];
  unitMonth: string[];
  unitYear: string[];
  weekend: string[];
  nextWeek: string[];
  nextMonth: string[];
  /** Start / due qualifiers: "с понедельника", "до пятницы". */
  fromWords: string[];
  byWords: string[];
  atWords: string[];
  timeOfDay: Record<string, string>;
  /** Hour qualifiers after a number: "6 вечера" → +12. */
  hourSuffix: Record<string, 'am' | 'pm' | 'night' | 'day'>;
  every: string[];
  everyDay: string[];
  weekdaysRepeat: string[];
  weekendsRepeat: string[];
  everyWeek: string[];
  everyMonth: string[];
  everyYear: string[];
  everyOther: string[];
  /** "каждое 15 число", "every 15th". */
  monthDayWords: string[];
  and: string[];
  priorities: Record<string, 'critical' | 'high' | 'medium' | 'low'>;
  remind: RegExp;
  hourUnits: string[];
  minuteUnits: string[];
  numericUnits: string[];
  counterUnits: string[];
}

const ru: Lexicon = {
  weekdays: [
    ['воскресенье', 'воскресенья', 'вс'],
    ['понедельник', 'понедельника', 'пн'],
    ['вторник', 'вторника', 'вт'],
    ['среду', 'среда', 'среды', 'ср'],
    ['четверг', 'четверга', 'чт'],
    ['пятницу', 'пятница', 'пятницы', 'пт'],
    ['субботу', 'суббота', 'субботы', 'сб'],
  ],
  weekdayPlurals: [
    ['воскресеньям'],
    ['понедельникам'],
    ['вторникам'],
    ['средам'],
    ['четвергам'],
    ['пятницам'],
    ['субботам'],
  ],
  weekdaysDative: [
    ['воскресенью'],
    ['понедельнику'],
    ['вторнику'],
    ['среде'],
    ['четвергу'],
    ['пятнице'],
    ['субботе'],
  ],
  months: [
    ['января', 'январь', 'янв'],
    ['февраля', 'февраль', 'фев'],
    ['марта', 'март', 'мар'],
    ['апреля', 'апрель', 'апр'],
    ['мая', 'май'],
    ['июня', 'июнь', 'июн'],
    ['июля', 'июль', 'июл'],
    ['августа', 'август', 'авг'],
    ['сентября', 'сентябрь', 'сен', 'сент'],
    ['октября', 'октябрь', 'окт'],
    ['ноября', 'ноябрь', 'ноя'],
    ['декабря', 'декабрь', 'дек'],
  ],
  numberWords: { один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10 },
  today: ['сегодня'],
  tomorrow: ['завтра'],
  afterTomorrow: ['послезавтра'],
  onWords: ['в', 'во'],
  nextWords: ['следующий', 'следующую', 'следующее', 'следующая'],
  inWords: ['через'],
  unitDay: ['день', 'дня', 'дней', 'сутки'],
  unitWeek: ['неделю', 'недели', 'недель', 'неделя'],
  unitMonth: ['месяц', 'месяца', 'месяцев'],
  unitYear: ['год', 'года', 'лет'],
  weekend: ['на выходных', 'в выходные'],
  nextWeek: ['на следующей неделе'],
  nextMonth: ['в следующем месяце'],
  fromWords: ['с', 'со'],
  byWords: ['до', 'к'],
  atWords: ['в', 'к'],
  timeOfDay: { утром: '09:00', днём: '13:00', днем: '13:00', вечером: '19:00', ночью: '23:00', 'в полдень': '12:00', 'в полночь': '23:59' },
  hourSuffix: { утра: 'am', дня: 'day', вечера: 'pm', ночи: 'night' },
  every: ['каждый', 'каждую', 'каждое', 'каждые'],
  everyDay: ['каждый день', 'ежедневно'],
  weekdaysRepeat: ['по будням', 'по рабочим дням', 'каждый будний день', 'в будни'],
  weekendsRepeat: ['по выходным', 'каждые выходные'],
  everyWeek: ['каждую неделю', 'еженедельно'],
  everyMonth: ['каждый месяц', 'ежемесячно'],
  everyYear: ['каждый год', 'ежегодно'],
  everyOther: [],
  monthDayWords: ['число', 'числа'],
  and: ['и', ','],
  priorities: {
    критический: 'critical',
    критичный: 'critical',
    крит: 'critical',
    срочно: 'critical',
    высокий: 'high',
    важно: 'high',
    средний: 'medium',
    низкий: 'low',
  },
  remind:
    /напомн(?:и|ить)\s+за\s+(\d+|полчаса|час|день|сутки)(?:\s*(минут[уы]?|мин|м|час(?:а|ов)?|ч|дн(?:я|ей)|день|сутки))?/iu,
  hourUnits: ['ч', 'час', 'часа', 'часов'],
  minuteUnits: ['м', 'мин', 'минут', 'минуты', 'минуту'],
  numericUnits: ['страниц', 'страницы', 'страницу', 'стр', 'глав', 'главы', 'км', 'километров', 'километра', 'шагов', 'шага', 'слов', 'слова', 'задач', 'задачи', 'уроков', 'урока'],
  counterUnits: ['стаканов', 'стакана', 'стакан', 'раз', 'раза', 'подходов', 'подхода', 'чашек', 'чашки'],
};

const en: Lexicon = {
  weekdays: [
    ['sunday'],
    ['monday', 'mon'],
    ['tuesday', 'tue', 'tues'],
    ['wednesday'],
    ['thursday', 'thu', 'thur', 'thurs'],
    ['friday', 'fri'],
    ['saturday'],
  ],
  months: [
    ['january', 'jan'],
    ['february', 'feb'],
    ['march', 'mar'],
    ['april', 'apr'],
    ['may'],
    ['june', 'jun'],
    ['july', 'jul'],
    ['august', 'aug'],
    ['september', 'sep', 'sept'],
    ['october', 'oct'],
    ['november', 'nov'],
    ['december', 'dec'],
  ],
  numberWords: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
  today: ['today'],
  tomorrow: ['tomorrow', 'tmrw'],
  afterTomorrow: ['day after tomorrow'],
  onWords: ['on', 'this'],
  nextWords: ['next'],
  inWords: ['in'],
  unitDay: ['day', 'days'],
  unitWeek: ['week', 'weeks'],
  unitMonth: ['month', 'months'],
  unitYear: ['year', 'years'],
  weekend: ['this weekend', 'on the weekend', 'at the weekend', 'weekend'],
  nextWeek: ['next week'],
  nextMonth: ['next month'],
  fromWords: ['from', 'starting'],
  byWords: ['by', 'until', 'due'],
  atWords: ['at'],
  timeOfDay: { morning: '09:00', noon: '12:00', afternoon: '15:00', evening: '19:00', tonight: '20:00', midnight: '23:59' },
  hourSuffix: { am: 'am', pm: 'pm', 'a.m.': 'am', 'p.m.': 'pm' },
  every: ['every', 'each'],
  everyDay: ['every day', 'daily'],
  weekdaysRepeat: ['every weekday', 'weekdays', 'on weekdays'],
  weekendsRepeat: ['every weekend', 'weekends', 'on weekends'],
  everyWeek: ['every week', 'weekly'],
  everyMonth: ['every month', 'monthly'],
  everyYear: ['every year', 'yearly', 'annually'],
  everyOther: ['every other'],
  monthDayWords: [],
  and: ['and', ','],
  priorities: { critical: 'critical', crit: 'critical', urgent: 'critical', high: 'high', important: 'high', medium: 'medium', med: 'medium', normal: 'medium', low: 'low' },
  remind: /remind(?:\s+me)?\s+(\d+)\s*(m|min|mins|minutes?|h|hrs?|hours?|d|days?)\s+before/iu,
  hourUnits: ['h', 'hr', 'hrs', 'hour', 'hours'],
  minuteUnits: ['m', 'min', 'mins', 'minute', 'minutes'],
  numericUnits: ['pages', 'page', 'chapters', 'km', 'miles', 'steps', 'words', 'tasks', 'lessons'],
  counterUnits: ['glasses', 'glass', 'cups', 'cup', 'times', 'sets'],
};

const bg: Lexicon = {
  weekdays: [
    ['неделя', 'нд'],
    ['понеделник', 'пн'],
    ['вторник', 'вт'],
    ['сряда', 'ср'],
    ['четвъртък', 'чт'],
    ['петък', 'пт'],
    ['събота', 'сб'],
  ],
  months: [
    ['януари', 'яну'],
    ['февруари', 'фев'],
    ['март', 'мар'],
    ['април', 'апр'],
    ['май'],
    ['юни'],
    ['юли'],
    ['август', 'авг'],
    ['септември', 'сеп'],
    ['октомври', 'окт'],
    ['ноември', 'ное'],
    ['декември', 'дек'],
  ],
  numberWords: { един: 1, една: 1, едно: 1, два: 2, две: 2, три: 3, четири: 4, пет: 5, шест: 6, седем: 7, осем: 8, девет: 9, десет: 10 },
  today: ['днес'],
  tomorrow: ['утре'],
  afterTomorrow: ['вдругиден'],
  onWords: ['в', 'във'],
  nextWords: ['следващия', 'следващата', 'следващото'],
  inWords: ['след'],
  unitDay: ['ден', 'дни', 'дена'],
  unitWeek: ['седмица', 'седмици'],
  unitMonth: ['месец', 'месеца'],
  unitYear: ['година', 'години'],
  weekend: ['през уикенда', 'в уикенда', 'уикенда'],
  nextWeek: ['следващата седмица'],
  nextMonth: ['следващия месец'],
  fromWords: ['от'],
  byWords: ['до'],
  atWords: ['в', 'във'],
  timeOfDay: { сутринта: '09:00', 'на обяд': '12:00', следобед: '15:00', вечерта: '19:00', довечера: '19:00', 'в полунощ': '23:59' },
  hourSuffix: { сутринта: 'am', следобед: 'day', вечерта: 'pm', през_нощта: 'night' },
  every: ['всеки', 'всяка', 'всяко'],
  everyDay: ['всеки ден', 'ежедневно'],
  weekdaysRepeat: ['в делнични дни', 'делнични дни', 'всеки делничен ден'],
  weekendsRepeat: ['през уикендите', 'всеки уикенд'],
  everyWeek: ['всяка седмица', 'седмично', 'ежеседмично'],
  everyMonth: ['всеки месец', 'месечно', 'ежемесечно'],
  everyYear: ['всяка година', 'годишно', 'ежегодно'],
  everyOther: [],
  monthDayWords: ['число'],
  and: ['и', ','],
  priorities: { критичен: 'critical', критично: 'critical', спешно: 'critical', висок: 'high', важно: 'high', среден: 'medium', нисък: 'low' },
  remind: /напомни\s+(\d+)\s*(мин|минути|минута|ч|час|часа|дни|ден)\s+преди/iu,
  hourUnits: ['ч', 'час', 'часа', 'часове'],
  minuteUnits: ['м', 'мин', 'минути', 'минута'],
  numericUnits: ['страници', 'страница', 'стр', 'глави', 'км', 'километра', 'стъпки', 'думи', 'задачи', 'урока'],
  counterUnits: ['чаши', 'чаша', 'пъти', 'серии'],
};

export const lexicons: Record<QuickLocale, Lexicon> = { ru, en, bg };
