import { describe, expect, it } from 'vitest';
import { allZones, describeZone, searchZones } from '@/lib/time/zones';

const summer = new Date('2026-07-01T12:00:00Z');

describe('time zones', () => {
  it('names popular cities in Russian and Bulgarian, English falls back to IANA', () => {
    expect(describeZone('Europe/London', 'ru', summer).city).toBe('Лондон');
    expect(describeZone('Europe/Athens', 'bg', summer).city).toBe('Атина');
    expect(describeZone('America/New_York', 'en', summer).city).toBe('New York');
  });

  it('shows the offset as UTC±h', () => {
    expect(describeZone('Europe/Moscow', 'ru', summer).offset).toBe('UTC+3');
    expect(describeZone('UTC', 'ru', summer).offset).toBe('UTC');
  });

  it('finds cities by their Russian name first, and by English name too', () => {
    const zones = allZones().map((z) => describeZone(z, 'ru', summer));
    expect(searchZones(zones, 'лон')[0]?.id).toBe('Europe/London');
    expect(searchZones(zones, 'london')[0]?.id).toBe('Europe/London');
    expect(searchZones(zones, 'киев').map((z) => z.id)).toEqual(expect.arrayContaining([expect.stringMatching(/^Europe\/Ki?y?ev|Europe\/Kyiv$/)]));
    expect(searchZones(zones, 'Кишинев')[0]?.id).toBe('Europe/Chisinau');
  });

  it('includes UTC even where the engine omits it', () => {
    expect(allZones()).toContain('UTC');
  });
});
