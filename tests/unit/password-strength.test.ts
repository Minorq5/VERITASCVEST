import { describe, expect, it } from 'vitest';
import { estimatePasswordStrength, MIN_PASSWORD_LENGTH } from '@/lib/security/password-strength';

describe('estimatePasswordStrength', () => {
  it('empty password is "empty"', () => {
    expect(estimatePasswordStrength('')).toMatchObject({ level: 0, label: 'empty' });
  });

  it.each(['password', '12345678', 'qwerty123', 'пароль123', 'парола', 'йцукенгш', 'Password1!'])(
    'common password %s is weak',
    (pw) => {
      expect(estimatePasswordStrength(pw).level).toBeLessThanOrEqual(1);
    },
  );

  it('short passwords never reach "fair"', () => {
    expect(estimatePasswordStrength('aB3$x').level).toBe(1);
    expect('aB3$x'.length).toBeLessThan(MIN_PASSWORD_LENGTH);
  });

  it('repeats and keyboard runs are penalised', () => {
    expect(estimatePasswordStrength('aaaaaaaaaaaa').level).toBe(1);
    expect(estimatePasswordStrength('abcdefghijkl').level).toBeLessThanOrEqual(2);
  });

  it('long mixed passwords are strong (Latin and Cyrillic)', () => {
    expect(estimatePasswordStrength('orbit-Kometa-2026').level).toBe(4);
    expect(estimatePasswordStrength('Звезда-над-Орбитой-7').level).toBe(4);
    expect(estimatePasswordStrength('Звёздна-Орбита-2026').level).toBe(4);
  });

  it('containing the username or email lowers the score', () => {
    const plain = estimatePasswordStrength('maria-orbit-42').bits;
    const withName = estimatePasswordStrength('maria-orbit-42', ['maria']).bits;
    expect(withName).toBeLessThan(plain);
  });

  it('levels are monotonic in length for random-looking input', () => {
    const levels = ['k9$Qp', 'k9$Qp2Lm', 'k9$Qp2Lm7xR', 'k9$Qp2Lm7xR!vT4'].map(
      (pw) => estimatePasswordStrength(pw).level,
    );
    for (let i = 1; i < levels.length; i += 1)
      expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
  });
});
