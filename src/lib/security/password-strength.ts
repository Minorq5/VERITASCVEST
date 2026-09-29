/**
 * Lightweight password strength estimate (no 800 KB dictionaries).
 * Works for Latin and Cyrillic passwords. Server-side rules live in Supabase
 * Auth (minimum length); this estimate only guides the person.
 */

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;
export type StrengthLabel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface StrengthResult {
  level: StrengthLevel;
  label: StrengthLabel;
  /** Rough entropy in bits after penalties. */
  bits: number;
}

export const MIN_PASSWORD_LENGTH = 8;

const COMMON = new Set([
  'password',
  'password1',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'admin123',
  'welcome1',
  'sunshine',
  'football',
  'baseball',
  'monkey123',
  'letmein1',
  'abc12345',
  '11111111',
  '00000000',
  '87654321',
  'asdfghjk',
  'zxcvbnm1',
  'dragon12',
  'princess',
  'superman',
  'trustno1',
  'master12',
  'пароль',
  'пароль123',
  'йцукенгш',
  'qwertyqwerty',
  'парола',
  'парола123',
  'любовь123',
  'привет123',
  'здравейте',
  'veritas',
  'veritastasks',
]);

const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  'абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
  'йцукенгшщзхъ',
  'фывапролджэ',
  'ячсмитьбю',
];

function poolSize(password: string): number {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[а-яёѝ]/.test(password)) pool += 33;
  if (/[А-ЯЁЍ]/.test(password)) pool += 33;
  if (/[^a-zA-Z0-9а-яёА-ЯЁѝЍ]/.test(password)) pool += 33;
  return Math.max(pool, 10);
}

/** Characters that add little: repeats ("aaaa") and runs ("1234", "qwer"). */
function predictableChars(password: string): number {
  const lower = password.toLowerCase();
  let predictable = 0;
  for (let i = 1; i < lower.length; i += 1) {
    const prev = lower[i - 1] ?? '';
    const cur = lower[i] ?? '';
    if (cur === prev) {
      predictable += 1;
      continue;
    }
    const pair = prev + cur;
    if (SEQUENCES.some((seq) => seq.includes(pair) || [...seq].reverse().join('').includes(pair))) {
      predictable += 1;
    }
  }
  return predictable;
}

export function estimatePasswordStrength(password: string, context: string[] = []): StrengthResult {
  if (!password) return { level: 0, label: 'empty', bits: 0 };

  const lower = password.toLowerCase();
  const effectiveLength = Math.max(1, password.length - predictableChars(password) * 0.75);
  let bits = effectiveLength * Math.log2(poolSize(password));

  const isCommon = COMMON.has(lower) || COMMON.has(lower.replace(/[!.\d]+$/, ''));
  const containsContext = context
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length >= 3)
    .some((c) => lower.includes(c));

  if (isCommon) bits = Math.min(bits, 10);
  if (containsContext) bits -= 18;
  if (password.length < MIN_PASSWORD_LENGTH) bits = Math.min(bits, 27);
  bits = Math.max(0, Math.round(bits));

  let level: StrengthLevel;
  if (bits < 28) level = 1;
  else if (bits < 40) level = 2;
  else if (bits < 60) level = 3;
  else level = 4;

  const labels: Record<StrengthLevel, StrengthLabel> = {
    0: 'empty',
    1: 'weak',
    2: 'fair',
    3: 'good',
    4: 'strong',
  };
  return { level, label: labels[level], bits };
}
