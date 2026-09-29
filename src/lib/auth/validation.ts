import { z } from 'zod';

export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,23}$/;
export const PASSWORD_MIN = 8;

/** Mirrors the database rule private.is_valid_username(). */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export const emailSchema = z.email().max(254);

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(z.string().regex(USERNAME_PATTERN));

/** Mirrors Supabase Auth: minimum length 8, letters and digits required. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN)
  .max(128)
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v));

export const displayNameSchema = z.string().trim().min(1).max(60);
export const bioSchema = z.string().max(280);
