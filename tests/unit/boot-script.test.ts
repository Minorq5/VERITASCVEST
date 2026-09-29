import { describe, expect, it } from 'vitest';
import { bootScript } from '@/lib/boot-script';

/** Runs the boot script against a fake page and returns the <html> attributes it set. */
function boot({ path = '/ru', device = {}, seen = false, session = false, webdriver = false } = {}) {
  const attrs: Record<string, string> = {};
  const local: Record<string, string> = { 'vt:device': JSON.stringify({ state: device }) };
  if (seen) local['vt:intro-seen'] = '1';
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  const localStorage = { getItem: (k: string) => local[k] ?? null };
  const sessionStorage = { getItem: (k: string) => (session && k === 'vt:intro-played' ? '1' : null) };
  new Function('document', 'localStorage', 'sessionStorage', 'location', 'navigator', bootScript)(
    document,
    localStorage,
    sessionStorage,
    { pathname: path },
    { webdriver },
  );
  return attrs;
}

describe('boot script', () => {
  it('is valid JavaScript (escaping inside the template string)', () => {
    expect(() => new Function(bootScript)).not.toThrow();
  });

  it('applies the accent and less motion before the first paint', () => {
    expect(boot({ device: { accent: 'blue', motion: 'reduced' } })).toMatchObject({ 'data-accent': 'blue', 'data-motion': 'reduced' });
    expect(boot({ device: { accent: 'nebula' } })['data-accent']).toBe('amber');
  });

  it('plays the full intro on the first visit, the short one later, once per session', () => {
    expect(boot()['data-intro']).toBe('full');
    expect(boot({ seen: true })['data-intro']).toBe('short');
    expect(boot({ session: true })['data-intro']).toBeUndefined();
    expect(boot({ device: { intro: 'short' } })['data-intro']).toBe('short');
    expect(boot({ device: { intro: 'off' } })['data-intro']).toBeUndefined();
  });

  it('never plays on email links, dev pages or for automated browsers', () => {
    for (const path of ['/ru/auth/confirm', '/en/cinema', '/ru/og-card', '/ru/design']) expect(boot({ path })['data-intro']).toBeUndefined();
    expect(boot({ path: '/ru/login' })['data-intro']).toBe('full');
    expect(boot({ webdriver: true })['data-intro']).toBeUndefined();
  });
});
