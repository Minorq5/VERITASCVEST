import { Globe2, Palette, ShieldCheck, UserRound, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const settingsSections = ['account', 'appearance', 'sound', 'language', 'privacy'] as const;
export type SettingsSection = (typeof settingsSections)[number];

export const sectionIcons: Record<SettingsSection, LucideIcon> = {
  account: UserRound,
  appearance: Palette,
  sound: Volume2,
  language: Globe2,
  privacy: ShieldCheck,
};

export function isSettingsSection(value: string): value is SettingsSection {
  return (settingsSections as readonly string[]).includes(value);
}
