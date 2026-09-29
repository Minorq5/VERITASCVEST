import { ArrowRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoLockup } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Button } from '@/components/ui/button';
import { BlackHoleScene } from '@/features/cinema/black-hole/black-hole-scene';
import { AppPreview } from '@/features/landing/app-preview';
import { Link } from '@/i18n/navigation';

/**
 * The landing's first screen (DESIGN_V2 §8.2): a large headline on the left,
 * a live black hole on the right in a viewport, and under it a real piece of
 * the app. The full scroll-down fall toward the hole comes with the 3D stage.
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  const t = await getTranslations('home');
  const specs = (['types', 'languages', 'network'] as const).map((key) => ({
    key,
    label: t(`specs.${key}.label`),
    value: t(`specs.${key}.value`),
  }));

  return (
    <>
      <SpaceBackdrop />
      <header className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6 lg:px-12">
        <Link href="/" className="rounded-sm focus-ring" aria-label="Veritas Tasks">
          <LogoLockup size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
            <Link href="/login">{t('signIn')}</Link>
          </Button>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-4 pb-16 sm:px-8 lg:grid lg:min-h-[calc(100dvh-5.5rem)] lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-12 lg:py-10"
      >
        {/* The viewport onto the black hole: full-bleed on a phone, a framed window on a desktop,
            with a piece of the app overlapping its lower corner. */}
        <section className="relative -mx-4 sm:-mx-8 lg:order-2 lg:col-span-7 lg:mx-0">
          <BlackHoleScene
            scene="hero"
            preload
            sway
            position={[0.5, 0.4]}
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="aspect-[16/11] w-full lg:aspect-[7/6] lg:rounded-md lg:border lg:border-line-strong"
          />
          <AppPreview className="absolute -bottom-10 -left-10 z-10 w-[25rem] max-lg:hidden" />
        </section>

        <section className="lg:order-1 lg:col-span-5">
          <p className="label-mono text-accent">{t('eyebrow')}</p>
          <h1 className="mt-4 max-w-[14ch] font-display text-[clamp(2.375rem,4.2vw,4.5rem)] leading-[1.03] font-medium tracking-[-0.035em] text-fg sm:mt-5">
            {t('title')}
          </h1>
          <p className="mt-6 max-w-[34rem] text-md text-fg-2 sm:text-lg">{t('lead')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg">
              <Link href="/register">
                {t('start')}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/login">{t('signIn')}</Link>
            </Button>
          </div>
          <AppPreview className="mt-12 lg:hidden" />
          <dl className="mt-12 grid max-w-[34rem] border-t border-line sm:grid-cols-3">
            {specs.map((s) => (
              <div
                key={s.key}
                className="flex items-baseline justify-between gap-4 border-b border-line py-3 sm:block sm:border-b-0 sm:pt-4 sm:pr-4 sm:pb-0 sm:not-first:border-l sm:not-first:pl-4"
              >
                <dt className="label-mono">{s.label}</dt>
                <dd className="font-mono text-sm text-fg sm:mt-1.5">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
