import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/features/shell/app-shell';

export default async function ShellLayout({ children, params }: LayoutProps<'/[locale]'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <AppShell>{children}</AppShell>;
}
