'use client';

import { RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAccountRealtime, useSettings } from '@/features/account/queries';
import { usePathname, useRouter } from '@/i18n/navigation';
import { accents, type Accent } from '@/lib/device';
import { routing, type AppLocale } from '@/i18n/routing';
import { sound } from '@/sound/engine';
import { useDeviceSettings } from '@/stores/device-settings';
import { useSession } from '@/stores/session';
import { SyncProvider } from '@/features/sync/sync-provider';
import { LaunchScreen } from './launch-screen';

/** Whose preferred language was already applied during this page load. */
let localeAppliedFor: string | null = null;

/**
 * Everything behind sign-in passes through here: restores the session,
 * sends first-timers to onboarding, applies account preferences (accent,
 * language, sounds) and keeps them live across devices.
 */
export function AppGuard({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const status = useSession((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as AppLocale;
  const settings = useSettings();
  const setDevice = useDeviceSettings((s) => s.set);
  const userId = useSession((s) => s.user?.id);
  useAccountRealtime();

  useEffect(() => {
    if (status === 'signed-out') router.replace({ pathname: '/login', query: { next: pathname } });
  }, [status, router, pathname]);

  const data = settings.data;

  useEffect(() => {
    if (!data) return;
    if (!data.onboarding_completed_at && pathname !== '/onboarding') router.replace('/onboarding');
  }, [data, pathname, router]);

  // Account preferences follow the person to every device.
  useEffect(() => {
    if (!data) return;
    if ((accents as readonly string[]).includes(data.accent)) setDevice('accent', data.accent as Accent);
    sound.configure({
      enabled: data.sound_enabled,
      volume: data.sound_volume,
      ui: data.sound_ui,
      fx: data.sound_fx,
      ambient: data.sound_ambient,
    });
  }, [data, setDevice]);

  // The space ambient, if the person turned it on (off by default). Browsers
  // let it start only after the first click or key press.
  const ambientOn = Boolean(data?.sound_enabled && data.ambient_enabled);
  useEffect(() => {
    if (!ambientOn) return;
    const start = () => sound.startAmbient();
    if (navigator.userActivation?.hasBeenActive) start();
    else window.addEventListener('pointerdown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      sound.stopAmbient();
    };
  }, [ambientOn]);

  // Once per page load: open the app in the language the account prefers.
  // Later switches (settings, onboarding) go through useSetLocale.
  useEffect(() => {
    if (!data || !userId || localeAppliedFor === userId) return;
    localeAppliedFor = userId;
    const preferred = data.locale as AppLocale;
    if (preferred !== locale && (routing.locales as readonly string[]).includes(preferred)) {
      router.replace(pathname, { locale: preferred });
    }
  }, [data, userId, locale, pathname, router]);

  if (settings.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState
          title={t('errors.errorTitle')}
          description={t('auth.errors.network')}
          action={
            <Button variant="primary" icon={<RotateCcw />} onClick={() => void settings.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (status !== 'signed-in' || !data) return <LaunchScreen label={t('common.loading')} />;
  if (!data.onboarding_completed_at && pathname !== '/onboarding') return <LaunchScreen label={t('common.loading')} />;
  return <SyncProvider>{children}</SyncProvider>;
}
