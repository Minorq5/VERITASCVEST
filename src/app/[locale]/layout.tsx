import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fontVariables } from '@/app/fonts';
import { Providers } from '@/components/providers';
import { bootScript } from '@/lib/boot-script';
import { siteUrl } from '@/lib/site';
import { localeTags, routing } from '@/i18n/routing';
import '@/styles/globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t('title'), template: '%s · Veritas Tasks' },
    description: t('description'),
    applicationName: 'Veritas Tasks',
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [localeTags[l], `/${l}`])),
    },
    openGraph: {
      type: 'website',
      siteName: 'Veritas Tasks',
      title: t('title'),
      description: t('description'),
      locale: localeTags[locale].replace('-', '_'),
      images: [{ url: `/og/og-${locale}.jpg`, width: 1200, height: 630, alt: t('title') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [`/og/og-${locale}.jpg`],
    },
    appleWebApp: { capable: true, title: 'Veritas', statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#060912',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'a11y' });

  return (
    <html lang={locale} className={fontVariables} data-accent="cyan" suppressHydrationWarning>
      <body>
        <Script id="vt-boot" strategy="beforeInteractive">
          {bootScript}
        </Script>
        <a
          href="#main"
          className="fixed top-4 left-4 z-[var(--z-toast)] -translate-y-24 rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink focus-ring transition-transform focus:translate-y-0"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
