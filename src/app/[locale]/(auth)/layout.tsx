import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoLockup } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { BlackHoleScene } from '@/features/cinema/black-hole/black-hole-scene';
import { Link } from '@/i18n/navigation';

/**
 * Sign-in and sign-up (DESIGN_V2 §8.2): the form on a dark panel on the left,
 * a distant black hole on the right, its disk turning slowly. On a phone the
 * black hole is a band at the top and the panel runs to the bottom.
 */
export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  const t = await getTranslations('auth');
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[30rem_1fr]">
      <BlackHoleScene
        scene="auth"
        preload
        speed={0.2}
        sizes="(min-width: 1024px) 70vw, 100vw"
        className="h-52 shrink-0 sm:h-64 lg:sticky lg:top-0 lg:order-2 lg:h-dvh"
      />
      <div className="relative flex flex-1 flex-col border-line bg-surface-1 max-lg:border-t lg:order-1 lg:min-h-dvh lg:border-r">
        <header className="flex items-center justify-between px-5 pt-5 max-lg:absolute max-lg:inset-x-0 max-lg:-top-52 max-lg:pt-[max(1rem,env(safe-area-inset-top))] sm:px-10 max-lg:sm:-top-64 lg:px-8 lg:pt-8">
          <Link href="/" className="rounded-sm focus-ring" aria-label="Veritas Tasks">
            <LogoLockup size="sm" />
          </Link>
          <LocaleSwitcher />
        </header>
        <main
          id="main"
          className="flex flex-1 flex-col px-5 pt-8 pb-10 sm:px-10 lg:justify-center lg:px-8 lg:py-16"
        >
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>
        <footer className="px-5 pb-6 font-mono text-[0.6875rem] tracking-[0.08em] text-fg-4 uppercase sm:px-10 lg:px-8 lg:pb-8">
          Veritas Tasks · {t('brandLine')}
        </footer>
      </div>
    </div>
  );
}
