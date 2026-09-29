'use client';

import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeNames, routing, type AppLocale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('locale');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          icon={<Languages />}
          loading={pending}
          aria-label={t('label')}
        >
          {compact ? locale.toUpperCase() : localeNames[locale]}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-44">
        {routing.locales.map((l) => (
          <MenuItem
            key={l}
            lang={l}
            aria-label={t('switchTo', { language: localeNames[l] })}
            onSelect={() => startTransition(() => router.replace(pathname, { locale: l }))}
            icon={<Check className={l === locale ? 'text-accent' : 'opacity-0'} />}
          >
            {localeNames[l]}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
