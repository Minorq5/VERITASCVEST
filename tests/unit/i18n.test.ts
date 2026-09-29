import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';
import bg from '@/messages/bg.json';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

type Tree = { [key: string]: string | string[] | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') acc[path] = value;
    else if (Array.isArray(value)) value.forEach((item, i) => (acc[`${path}.${i}`] = item));
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const locales = { ru: flatten(ru), en: flatten(en), bg: flatten(bg) };
/**
 * Argument names a message shows (parsing also proves the ICU syntax is valid).
 * Names used only as `select` switches carry grammar (gender, case) and may be
 * absent in a language that does not need them.
 */
function placeholders(text: string): string[] {
  const shown = new Set<string>();
  const walk = (nodes: MessageFormatElement[]) => {
    for (const node of nodes) {
      if (node.type === TYPE.select) {
        for (const option of Object.values(node.options)) walk(option.value);
      } else if (node.type === TYPE.plural) {
        shown.add(node.value);
        for (const option of Object.values(node.options)) walk(option.value);
      } else if (node.type === TYPE.tag) {
        walk(node.children);
      } else if (node.type !== TYPE.literal && node.type !== TYPE.pound) {
        shown.add(node.value);
      }
    }
  };
  walk(parse(text));
  return [...shown].sort();
}

describe('translations', () => {
  it('every locale has exactly the same keys', () => {
    const reference = Object.keys(locales.ru).sort();
    expect(Object.keys(locales.en).sort()).toEqual(reference);
    expect(Object.keys(locales.bg).sort()).toEqual(reference);
  });

  it('no empty strings', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), `${locale}:${key}`).not.toBe('');
      }
    }
  });

  it('placeholders match across locales', () => {
    for (const key of Object.keys(locales.ru)) {
      const ref = placeholders(locales.ru[key]!);
      expect(placeholders(locales.en[key]!), `en:${key}`).toEqual(ref);
      expect(placeholders(locales.bg[key]!), `bg:${key}`).toEqual(ref);
    }
  });

  it('Russian plurals cover one/few/many, Bulgarian and English one/other', () => {
    for (const [key, value] of Object.entries(locales.ru)) {
      if (!value.includes('plural,')) continue;
      for (const form of ['one', 'few', 'many', 'other'])
        expect(value, `ru:${key}`).toContain(`${form} {`);
      for (const form of ['one', 'other']) {
        expect(locales.en[key], `en:${key}`).toContain(`${form} {`);
        expect(locales.bg[key], `bg:${key}`).toContain(`${form} {`);
      }
    }
  });

  it('short Russian/Bulgarian prepositions never hang at the end of a line', () => {
    // Run `node scripts/i18n/typograf.mjs` after editing translations.
    for (const locale of ['ru', 'bg'] as const) {
      for (const [key, value] of Object.entries(locales[locale])) {
        const text = value.replace(/\{[^{}]*\}/g, 'X');
        expect(text, `${locale}:${key}`).not.toMatch(
          /(^|[\s(«„"])(в|и|с|к|о|у|а|на|по|за|от|до|из|не) (?=\S)/iu,
        );
      }
    }
  });

  it('Russian and Bulgarian text never starts a line with a dash', () => {
    // A regular space before an em dash lets it wrap to the next line.
    for (const locale of ['ru', 'bg'] as const) {
      for (const [key, value] of Object.entries(locales[locale])) {
        expect(value, `${locale}:${key}`).not.toMatch(/\S —/u);
      }
    }
  });

  it('lists stay lists in every language (the typography pass must not turn them into objects)', () => {
    const lists = (tree: unknown, prefix = ''): string[] =>
      Array.isArray(tree)
        ? [prefix]
        : tree && typeof tree === 'object'
          ? Object.entries(tree).flatMap(([k, v]) => lists(v, prefix ? `${prefix}.${k}` : k))
          : [];
    const reference = lists(en).sort();
    expect(reference.length).toBeGreaterThan(0);
    expect(lists(ru).sort()).toEqual(reference);
    expect(lists(bg).sort()).toEqual(reference);
  });
});
