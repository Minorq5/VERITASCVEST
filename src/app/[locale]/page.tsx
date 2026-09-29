import { ArrowRight, Globe2, Smartphone, WifiOff } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoLockup, LogoMark } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  const t = await getTranslations('home');

  const pillars = [
    { icon: <WifiOff />, text: t('pillars.offline') },
    { icon: <Globe2 />, text: t('pillars.languages') },
    { icon: <Smartphone />, text: t('pillars.devices') },
  ];

  return (
    <>
      <SpaceBackdrop />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <Link href="/" className="rounded-md focus-ring" aria-label="Veritas Tasks">
          <LogoLockup size="sm" />
        </Link>
        <LocaleSwitcher />
      </header>

      <main
        id="main"
        className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-7xl flex-col items-center justify-center px-4 pt-10 pb-16 text-center sm:px-8"
      >
        <LogoMark size={112} animated detail="full" className="mb-8 sm:mb-10" />
        <p className="mb-5 eyebrow text-accent">{t('eyebrow')}</p>
        <h1 className="font-display text-[clamp(1.75rem,4.4vw,4.25rem)] leading-[1.1] font-semibold tracking-[-0.025em] text-fg">
          <span className="block">{t('title')}</span>
          <span className="block text-accent">
            {t('titleAccent')}
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-md text-fg-2 sm:text-lg">{t('lead')}</p>
        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild variant="primary" size="lg" block className="sm:w-auto">
            <Link href="/register">
              {t('start')}
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" block className="sm:w-auto">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
        </div>
        <ul className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-fg-3">
          {pillars.map((p) => (
            <li key={p.text} className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-fg-3">
              {p.icon}
              {p.text}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
