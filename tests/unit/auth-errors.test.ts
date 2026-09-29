import { describe, expect, it } from 'vitest';
import { authErrorKey } from '@/lib/auth/errors';
import { passwordSchema, usernameSchema } from '@/lib/auth/validation';

describe('authErrorKey', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'invalidCredentials'],
    [{ code: 'email_not_confirmed' }, 'emailNotConfirmed'],
    [{ code: 'over_email_send_rate_limit' }, 'emailRateLimit'],
    [{ code: '23514', message: 'invalid_username' }, 'invalidUsername'],
    [{ code: 'unexpected_failure', message: 'Database error saving new user' }, 'usernameTaken'],
    [{ code: 'PT429', message: 'rate_limited' }, 'tooManyRequests'],
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, 'network'],
    [{ message: 'something odd' }, 'unknown'],
  ])('%o → %s', (error, key) => {
    expect(authErrorKey(error)).toBe(key);
  });
});

describe('field rules mirror the server', () => {
  it('username', () => {
    expect(usernameSchema.safeParse('  Alice_Orbit ').data).toBe('alice_orbit');
    for (const bad of ['ab', '1abc', 'a-b-c', 'имя', 'a'.repeat(25)]) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
  it('password needs 8+ characters with letters and digits (any alphabet)', () => {
    expect(passwordSchema.safeParse('orbit2026').success).toBe(true);
    expect(passwordSchema.safeParse('звезда2026').success).toBe(true);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('a1').success).toBe(false);
  });
});
