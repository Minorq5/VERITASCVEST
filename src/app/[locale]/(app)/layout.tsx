import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AppGuard } from '@/features/shell/app-guard';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children, params }: LayoutProps<'/[locale]'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <AppGuard>{children}</AppGuard>;
}
