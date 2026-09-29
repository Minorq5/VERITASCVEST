import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know our custom scales, otherwise it would treat
 * `text-md` (size) and `text-fg-2` (colour) as the same group and drop one.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'],
      radius: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      shadow: ['xs', 'sm', 'md', 'lg', 'xl', 'glow-sm', 'glow-md', 'glow-lg'],
      blur: ['sm', 'md', 'lg', 'xl'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
