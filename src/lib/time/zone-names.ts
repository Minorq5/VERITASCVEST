/**
 * City names for popular time zones in Russian and Bulgarian. Browsers only
 * know the English IANA names ("Europe/London"), so without this list nobody
 * could find "Лондон". English falls back to the IANA city.
 * Legacy and current IANA spellings are both listed (Kiev/Kyiv, Calcutta/Kolkata).
 */
type Names = readonly [ru: string, bg: string];

const ZONES: Record<string, Names> = {
  UTC: ['UTC', 'UTC'],
  // Russia
  'Europe/Kaliningrad': ['Калининград', 'Калининград'],
  'Europe/Moscow': ['Москва', 'Москва'],
  'Europe/Samara': ['Самара', 'Самара'],
  'Europe/Volgograd': ['Волгоград', 'Волгоград'],
  'Europe/Saratov': ['Саратов', 'Саратов'],
  'Europe/Ulyanovsk': ['Ульяновск', 'Уляновск'],
  'Europe/Astrakhan': ['Астрахань', 'Астрахан'],
  'Europe/Kirov': ['Киров', 'Киров'],
  'Asia/Yekaterinburg': ['Екатеринбург', 'Екатеринбург'],
  'Asia/Omsk': ['Омск', 'Омск'],
  'Asia/Novosibirsk': ['Новосибирск', 'Новосибирск'],
  'Asia/Barnaul': ['Барнаул', 'Барнаул'],
  'Asia/Tomsk': ['Томск', 'Томск'],
  'Asia/Novokuznetsk': ['Новокузнецк', 'Новокузнецк'],
  'Asia/Krasnoyarsk': ['Красноярск', 'Красноярск'],
  'Asia/Irkutsk': ['Иркутск', 'Иркутск'],
  'Asia/Chita': ['Чита', 'Чита'],
  'Asia/Yakutsk': ['Якутск', 'Якутск'],
  'Asia/Vladivostok': ['Владивосток', 'Владивосток'],
  'Asia/Sakhalin': ['Южно-Сахалинск', 'Южно-Сахалинск'],
  'Asia/Magadan': ['Магадан', 'Магадан'],
  'Asia/Kamchatka': ['Петропавловск-Камчатский', 'Петропавловск-Камчатски'],
  'Asia/Anadyr': ['Анадырь', 'Анадир'],
  // Neighbours
  'Europe/Kyiv': ['Киев', 'Киев'],
  'Europe/Kiev': ['Киев', 'Киев'],
  'Europe/Minsk': ['Минск', 'Минск'],
  'Europe/Chisinau': ['Кишинёв', 'Кишинев'],
  'Europe/Riga': ['Рига', 'Рига'],
  'Europe/Vilnius': ['Вильнюс', 'Вилнюс'],
  'Europe/Tallinn': ['Таллин', 'Талин'],
  'Asia/Almaty': ['Алматы', 'Алмати'],
  'Asia/Tashkent': ['Ташкент', 'Ташкент'],
  'Asia/Bishkek': ['Бишкек', 'Бишкек'],
  'Asia/Dushanbe': ['Душанбе', 'Душанбе'],
  'Asia/Ashgabat': ['Ашхабад', 'Ашхабад'],
  'Asia/Baku': ['Баку', 'Баку'],
  'Asia/Tbilisi': ['Тбилиси', 'Тбилиси'],
  'Asia/Yerevan': ['Ереван', 'Ереван'],
  // Europe
  'Europe/Sofia': ['София', 'София'],
  'Europe/London': ['Лондон', 'Лондон'],
  'Europe/Dublin': ['Дублин', 'Дъблин'],
  'Europe/Lisbon': ['Лиссабон', 'Лисабон'],
  'Europe/Madrid': ['Мадрид', 'Мадрид'],
  'Europe/Paris': ['Париж', 'Париж'],
  'Europe/Brussels': ['Брюссель', 'Брюксел'],
  'Europe/Amsterdam': ['Амстердам', 'Амстердам'],
  'Europe/Berlin': ['Берлин', 'Берлин'],
  'Europe/Zurich': ['Цюрих', 'Цюрих'],
  'Europe/Rome': ['Рим', 'Рим'],
  'Europe/Vienna': ['Вена', 'Виена'],
  'Europe/Prague': ['Прага', 'Прага'],
  'Europe/Warsaw': ['Варшава', 'Варшава'],
  'Europe/Budapest': ['Будапешт', 'Будапеща'],
  'Europe/Belgrade': ['Белград', 'Белград'],
  'Europe/Zagreb': ['Загреб', 'Загреб'],
  'Europe/Skopje': ['Скопье', 'Скопие'],
  'Europe/Bucharest': ['Бухарест', 'Букурещ'],
  'Europe/Athens': ['Афины', 'Атина'],
  'Europe/Istanbul': ['Стамбул', 'Истанбул'],
  'Europe/Helsinki': ['Хельсинки', 'Хелзинки'],
  'Europe/Stockholm': ['Стокгольм', 'Стокхолм'],
  'Europe/Oslo': ['Осло', 'Осло'],
  'Europe/Copenhagen': ['Копенгаген', 'Копенхаген'],
  'Asia/Nicosia': ['Никосия', 'Никозия'],
  // Asia
  'Asia/Dubai': ['Дубай', 'Дубай'],
  'Asia/Jerusalem': ['Иерусалим', 'Йерусалим'],
  'Asia/Kolkata': ['Калькутта', 'Колката'],
  'Asia/Calcutta': ['Калькутта', 'Колката'],
  'Asia/Kathmandu': ['Катманду', 'Катманду'],
  'Asia/Katmandu': ['Катманду', 'Катманду'],
  'Asia/Bangkok': ['Бангкок', 'Банкок'],
  'Asia/Ho_Chi_Minh': ['Хошимин', 'Хо Ши Мин'],
  'Asia/Saigon': ['Хошимин', 'Хо Ши Мин'],
  'Asia/Jakarta': ['Джакарта', 'Джакарта'],
  'Asia/Singapore': ['Сингапур', 'Сингапур'],
  'Asia/Shanghai': ['Шанхай', 'Шанхай'],
  'Asia/Hong_Kong': ['Гонконг', 'Хонконг'],
  'Asia/Taipei': ['Тайбэй', 'Тайпе'],
  'Asia/Manila': ['Манила', 'Манила'],
  'Asia/Seoul': ['Сеул', 'Сеул'],
  'Asia/Tokyo': ['Токио', 'Токио'],
  // Americas
  'America/New_York': ['Нью-Йорк', 'Ню Йорк'],
  'America/Toronto': ['Торонто', 'Торонто'],
  'America/Chicago': ['Чикаго', 'Чикаго'],
  'America/Denver': ['Денвер', 'Денвър'],
  'America/Los_Angeles': ['Лос-Анджелес', 'Лос Анджелис'],
  'America/Vancouver': ['Ванкувер', 'Ванкувър'],
  'America/Mexico_City': ['Мехико', 'Мексико'],
  'America/Sao_Paulo': ['Сан-Паулу', 'Сао Пауло'],
  'America/Argentina/Buenos_Aires': ['Буэнос-Айрес', 'Буенос Айрес'],
  'America/Buenos_Aires': ['Буэнос-Айрес', 'Буенос Айрес'],
  // Africa, Oceania
  'Africa/Cairo': ['Каир', 'Кайро'],
  'Africa/Johannesburg': ['Йоханнесбург', 'Йоханесбург'],
  'Australia/Sydney': ['Сидней', 'Сидни'],
  'Australia/Melbourne': ['Мельбурн', 'Мелбърн'],
  'Pacific/Auckland': ['Окленд', 'Окланд'],
};

/** Localised city for a zone, or null when the list has none (English uses IANA names). */
export function localZoneCity(zone: string, locale: string): string | null {
  const names = ZONES[zone];
  if (!names) return null;
  if (locale === 'ru') return names[0];
  if (locale === 'bg') return names[1];
  return null;
}
