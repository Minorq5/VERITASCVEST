import { setRequestLocale } from 'next-intl/server';
import { LogoLockup } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { PlanetHorizon } from '@/features/auth/planet-horizon';
import { Link } from '@/i18n/navigation';

export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  return (
    <>
      <SpaceBackdrop />
      <PlanetHorizon />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <Link href="/" className="focus-ring rounded-md" aria-label="Veritas Tasks">
          <LogoLockup size="sm" />
        </Link>
        <LocaleSwitcher />
      </header>
      <main
        id="main"
        className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-[460px] flex-col justify-center px-4 pb-24 pt-8 sm:pb-40"
      >
        {children}
      </main>
    </>
  );
}
