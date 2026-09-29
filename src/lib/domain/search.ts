/**
 * Instant, offline search over tasks (title, tags, description, comments).
 *
 * Words match by their beginning, so "задач" finds «задача», «задачи»,
 * «задачей». Case, «ё»/«е», «й»/«и», «ѝ» and accents do not matter. Longer
 * words forgive a typo (one for 4–7 letters, two from 8): «прочитть» finds
 * «прочитать». Every word of the query must be found somewhere in the task.
 */

export interface Range {
  start: number;
  end: number;
}

export interface SearchDoc {
  id: string;
  title: string;
  description?: string;
  tags?: readonly string[];
  comments?: readonly string[];
}

export type SnippetField = 'description' | 'tag' | 'comment';

export interface SearchHit {
  id: string;
  score: number;
  /** Matched parts of the title. */
  title: Range[];
  /** Where else it matched, when the title alone does not show it. */
  snippet: { field: SnippetField; text: string; ranges: Range[] } | null;
}

interface Token {
  word: string;
  start: number;
  end: number;
}

const MARKS = /[̀-ͯ]/g;
const WORD = /[\p{L}\p{N}]+/gu;

/** Lower case without accents, «ё» → «е», «й» → «и», one output character per input character. */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    // Characters outside the basic plane (emoji…) stay as they are: two units in, two out.
    if (ch.length !== 1) {
      out += ch;
      continue;
    }
    const lower = ch.toLowerCase();
    const bare = lower.normalize('NFD').replace(MARKS, '');
    out += bare.length > 0 ? bare[0]! : lower[0]!;
  }
  return out;
}

function tokens(text: string): Token[] {
  const folded = fold(text);
  const out: Token[] = [];
  for (const m of folded.matchAll(WORD)) out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/** Words of a query, folded; duplicates dropped. */
export function queryWords(query: string): string[] {
  return [...new Set(tokens(query).map((t) => t.word))];
}

/** Typos forgiven for a query word of this length. */
function allowance(length: number): number {
  if (length >= 8) return 2;
  if (length >= 4) return 1;
  return 0;
}

/** Edit distance with swaps of neighbours (optimal string alignment), stopping early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = cur[0]!;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prevPrev[j - 2]! + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prevPrev = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * How well a word of the text answers a word of the query: 4 — the same word,
 * 3 — it starts with it, 1 — with a forgiven typo, 0 — no. `length` is how
 * much of the text word to highlight.
 */
function wordMatch(q: string, w: string): { score: number; length: number } {
  if (w === q) return { score: 4, length: w.length };
  if (w.startsWith(q)) return { score: 3, length: q.length };
  const max = allowance(q.length);
  if (max === 0 || w.length < q.length - max) return { score: 0, length: 0 };
  // Compare with the text word's beginnings of about the query's length.
  let bestLen = 0;
  let best = max + 1;
  for (let len = Math.max(1, q.length - max); len <= Math.min(w.length, q.length + max); len += 1) {
    const d = distance(q, w.slice(0, len), max);
    if (d < best || (d === best && len > bestLen)) {
      best = d;
      bestLen = len;
    }
  }
  return best <= max ? { score: 1, length: bestLen } : { score: 0, length: 0 };
}

interface FieldResult {
  score: number;
  ranges: Range[];
  matched: Set<string>;
}

function matchField(text: string, words: readonly string[]): FieldResult {
  const result: FieldResult = { score: 0, ranges: [], matched: new Set() };
  if (!text) return result;
  const toks = tokens(text);
  for (const q of words) {
    let best = 0;
    for (const t of toks) {
      const m = wordMatch(q, t.word);
      if (m.score === 0) continue;
      result.ranges.push({ start: t.start, end: t.start + m.length });
      if (m.score > best) best = m.score;
    }
    if (best > 0) {
      result.matched.add(q);
      result.score += best;
    }
  }
  result.ranges = merge(result.ranges);
  return result;
}

function merge(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** Parts of `text` that answer `query` (for highlighting anywhere). */
export function highlight(text: string, query: string): Range[] {
  return matchField(text, queryWords(query)).ranges;
}

/** A short piece of long text around its first match, with the matches inside it. */
export function snippetOf(text: string, ranges: readonly Range[], width = 72): { text: string; ranges: Range[] } {
  const first = ranges[0];
  if (!first || text.length <= width) return { text, ranges: [...ranges] };
  let start = Math.max(0, first.start - Math.floor(width / 3));
  // Start at a word boundary where possible.
  const space = text.lastIndexOf(' ', start);
  if (space > 0 && first.start - space < width / 2) start = space + 1;
  const end = Math.min(text.length, start + width);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  const shift = prefix.length - start;
  return {
    text: `${prefix}${text.slice(start, end)}${suffix}`,
    ranges: ranges.filter((r) => r.start >= start && r.end <= end).map((r) => ({ start: r.start + shift, end: r.end + shift })),
  };
}

const WEIGHT = { title: 3, tag: 2, description: 1, comment: 1 } as const;

/** Tasks where every word of the query is found, best first. */
export function searchDocs(docs: readonly SearchDoc[], query: string, limit = 50): SearchHit[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const title = matchField(doc.title, words);
    const found = new Set(title.matched);
    let score = title.score * WEIGHT.title;
    let snippet: SearchHit['snippet'] = null;
    const consider = (field: SnippetField, text: string) => {
      const r = matchField(text, words);
      if (r.matched.size === 0) return;
      let adds = false;
      for (const w of r.matched) {
        if (!found.has(w)) adds = true;
        found.add(w);
      }
      score += r.score * WEIGHT[field];
      // Show where the rest of the query was found.
      if (!snippet && (adds || title.matched.size === 0)) snippet = { field, ...snippetOf(text, r.ranges) };
    };
    for (const tag of doc.tags ?? []) consider('tag', tag);
    if (doc.description) consider('description', doc.description);
    for (const c of doc.comments ?? []) consider('comment', c);
    if (found.size < words.length) continue;
    hits.push({ id: doc.id, score, title: title.ranges, snippet });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
