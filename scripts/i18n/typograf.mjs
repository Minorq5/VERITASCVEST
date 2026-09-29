// Typographic pass for Russian and Bulgarian messages: short prepositions and
// conjunctions are glued to the next word with a no-break space, so they never
// hang at the end of a line. Run after editing translations:
//   node scripts/i18n/typograf.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const NBSP = '\u00a0';
const SHORT = {
  ru: [
    'в',
    'и',
    'с',
    'к',
    'о',
    'у',
    'а',
    'я',
    'но',
    'на',
    'по',
    'за',
    'от',
    'до',
    'из',
    'не',
    'ни',
    'об',
    'во',
    'со',
    'ко',
    'что',
    'как',
    'это',
  ],
  bg: [
    'в',
    'и',
    'с',
    'к',
    'о',
    'у',
    'а',
    'я',
    'на',
    'по',
    'за',
    'от',
    'до',
    'из',
    'не',
    'ни',
    'да',
    'че',
    'ще',
    'се',
    'си',
    'во',
    'със',
    'във',
  ],
};

export function typograf(text, locale) {
  const words = SHORT[locale];
  if (!words) return text;
  // Leave ICU placeholders untouched: split them out and process the rest.
  return text
    .split(/(\{[^{}]*\})/g)
    .map((chunk) =>
      chunk.startsWith('{')
        ? chunk
        : chunk.replace(/(?<=^|[\s(«„"])([А-Яа-яЁёЍѝ]{1,3}) (?=\S)/gu, (match, word) =>
            words.includes(word.toLowerCase()) ? `${word}${NBSP}` : match,
          ),
    )
    .join('');
}

function walk(value, locale) {
  if (typeof value === 'string') {
    // Apply twice so chains like "и в" are both glued.
    return typograf(typograf(value, locale), locale);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, locale)]));
  }
  return value;
}

if (process.argv[1]?.endsWith('typograf.mjs')) {
  for (const locale of ['ru', 'bg']) {
    const file = `src/messages/${locale}.json`;
    const data = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, `${JSON.stringify(walk(data, locale), null, 2)}\n`);
    console.log(`typograf: ${file}`);
  }
}
