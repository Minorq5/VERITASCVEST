import { localZoneCity } from './zone-names';

export interface Zone {
  id: string;
  city: string;
  region: string;
  offset: string;
  /** Localised generic name ("Москва, стандартное время"). */
  local: string;
  haystack: string;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function part(zone: string, locale: string, style: 'shortOffset' | 'longGeneric', now: Date) {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style }).formatToParts(now);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function describeZone(id: string, locale: string, now = new Date()): Zone {
  const segments = id.split('/');
  const english = (segments[segments.length - 1] ?? id).replace(/_/g, ' ');
  const city = localZoneCity(id, locale) ?? english;
  const region = segments.length > 1 ? segments[0]!.replace(/_/g, ' ') : '';
  const offset = part(id, 'en', 'shortOffset', now).replace(/^GMT([+-]0)?$/, 'UTC').replace('GMT', 'UTC') || 'UTC';
  const local = part(id, locale, 'longGeneric', now);
  return {
    id,
    city,
    region,
    offset,
    local,
    haystack: `${id} ${english} ${city} ${local} ${offset}`.toLowerCase().replace(/ё/g, 'е'),
  };
}

export function allZones(): string[] {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return list.includes('UTC') ? list : ['UTC', ...list];
}


/** Matches by English or local city, zone id or offset; cities that start with the query come first. */
export function searchZones(zones: Zone[], query: string): Zone[] {
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  if (!q) return zones;
  const rank = (z: Zone) => {
    const city = z.city.toLowerCase().replace(/ё/g, 'е');
    return city.startsWith(q) ? 0 : city.includes(q) ? 1 : 2;
  };
  return zones
    .filter((z) => z.haystack.includes(q))
    .map((z, i) => ({ z, i, r: rank(z) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ z }) => z);
}
