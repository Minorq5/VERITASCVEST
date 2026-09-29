import { describe, expect, it } from 'vitest';
import { fold, highlight, queryWords, searchDocs, snippetOf, type SearchDoc } from '@/lib/domain/search';

const docs: SearchDoc[] = [
  { id: 'a', title: 'Прочитать «Интерстеллар: наука за кадром»', tags: ['книги'] },
  { id: 'b', title: 'Позвонить в обсерваторию', description: 'Спросить про телескоп и ночные наблюдения Юпитера' },
  { id: 'c', title: 'Ёлка к празднику', tags: ['дом'] },
  { id: 'd', title: 'Отчёт по кварталу', comments: ['Добавь графики выручки, пожалуйста'] },
  { id: 'e', title: 'Задача на завтра', tags: ['работа'] },
  { id: 'f', title: 'Обади се на мама', tags: ['семейство'] },
  { id: 'g', title: 'Buy a new café table' },
];

const ids = (query: string) => searchDocs(docs, query).map((h) => h.id);

describe('fold', () => {
  it('lower case, ё→е, й→и, no accents, same length', () => {
    expect(fold('Ёлка Йога ѝ Café')).toBe('елка иога и cafe');
    for (const text of ['Ёжик', 'Ѝ', 'naïve', 'İstanbul', 'смайл 🙂 тут']) expect(fold(text)).toHaveLength(text.length);
  });
});

describe('searchDocs', () => {
  it('finds by the beginning of a word, in any case', () => {
    expect(ids('обсерв')).toEqual(['b']);
    expect(ids('ПРОЧИТ')).toEqual(['a']);
  });

  it('ё and е, й and и are the same letter', () => {
    expect(ids('елка')).toEqual(['c']);
    expect(ids('отчет')).toEqual(['d']);
  });

  it('forgives a typo in longer words', () => {
    expect(ids('обсервотория')).toEqual(['b']);
    expect(ids('прочитть')).toEqual(['a']);
    expect(ids('задачи')).toEqual(['e']); // a different ending is one letter away
  });

  it('short words must match exactly by their beginning', () => {
    expect(ids('до')).toEqual(['c', 'd']); // «дом» (tag) ranks above «добавь» (comment)
  });

  it('looks into description, tags and comments', () => {
    expect(ids('юпитер')).toEqual(['b']);
    expect(ids('книги')).toEqual(['a']);
    expect(ids('выручки')).toEqual(['d']);
  });

  it('every word of the query must be found', () => {
    expect(ids('позвонить телескоп')).toEqual(['b']);
    expect(ids('позвонить маме')).toEqual([]);
  });

  it('works for Bulgarian and English too', () => {
    expect(ids('обади')).toEqual(['f']);
    expect(ids('cafe')).toEqual(['g']);
  });

  it('title matches rank above matches elsewhere', () => {
    const list = searchDocs(
      [
        { id: 'desc', title: 'Купить продукты', description: 'молоко для отчёта' },
        { id: 'title', title: 'Отчёт о молоке' },
      ],
      'молок',
    );
    expect(list.map((h) => h.id)).toEqual(['title', 'desc']);
  });

  it('marks what matched: title ranges and a snippet for the rest', () => {
    const [hit] = searchDocs(docs, 'позвонить юпит');
    expect(hit?.title).toEqual([{ start: 0, end: 9 }]);
    expect(hit?.snippet?.field).toBe('description');
    const s = hit!.snippet!;
    expect(s.text.slice(s.ranges[0]!.start, s.ranges[0]!.end)).toBe('Юпит');
  });

  it('an empty query finds nothing', () => {
    expect(searchDocs(docs, '  ,. ')).toEqual([]);
  });
});

describe('highlight and snippets', () => {
  it('highlights the matched beginning of each word', () => {
    const text = 'Сходить в зал завтра';
    const ranges = highlight(text, 'зал завт');
    expect(ranges.map((r) => text.slice(r.start, r.end))).toEqual(['зал', 'завт']);
  });

  it('a long text is cut around the first match', () => {
    const text = `${'слово '.repeat(40)}телескоп ${'ещё '.repeat(30)}`;
    const ranges = highlight(text, 'телескоп');
    const s = snippetOf(text, ranges);
    expect(s.text.startsWith('…')).toBe(true);
    expect(s.text.endsWith('…')).toBe(true);
    expect(s.text.slice(s.ranges[0]!.start, s.ranges[0]!.end)).toBe('телескоп');
  });

  it('query words are folded and unique', () => {
    expect(queryWords('Ёлка ёлка, ЕЛКА!')).toEqual(['елка']);
  });
});
