'use client';

import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/features/account/queries';
import { cn } from '@/lib/utils/cn';
import { useSyncStatus } from '@/stores/sync-status';
import type { SyncStatus } from '@/lib/sync/engine';
import { useSync } from './sync-provider';

type Look = { icon: typeof Cloud; tone: string; spin?: boolean; key: string };

function look(status: SyncStatus | null): Look {
  if (!status) return { icon: Cloud, tone: 'text-fg-3', key: 'loading' };
  switch (status.state) {
    case 'syncing':
      return { icon: RefreshCw, tone: 'text-accent', spin: true, key: status.bootstrapped ? 'syncing' : 'loading' };
    case 'offline':
      return { icon: CloudOff, tone: 'text-warning', key: 'offline' };
    case 'error':
      return { icon: CloudAlert, tone: 'text-danger', key: 'error' };
    case 'auth':
      return { icon: CloudAlert, tone: 'text-danger', key: 'auth' };
    case 'standby':
      return { icon: Cloud, tone: 'text-fg-3', key: 'standby' };
    default:
      return status.pending > 0
        ? { icon: Cloud, tone: 'text-fg-2', key: 'pending' }
        : { icon: CloudCheck, tone: 'text-success', key: 'idle' };
  }
}

function useStatusText() {
  const t = useTranslations('sync');
  const locale = useLocale();
  const hour12 = useSettings().data?.time_format === '12h';
  const status = useSyncStatus((s) => s.status);
  const l = look(status);
  const title = l.key === 'pending' ? t('pending', { count: status?.pending ?? 0 }) : t(`state.${l.key}` as 'state.idle');
  const detail =
    status?.lastSyncAt && l.key !== 'loading'
      ? t('savedAt', {
          time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12 }).format(status.lastSyncAt),
        })
      : null;
  const extra = status && status.pending > 0 && l.key !== 'pending' ? t('pending', { count: status.pending }) : null;
  return { status, l, title, detail, extra };
}

/** Sidebar line: always tells whether work is safe on the server. */
export function SyncIndicator({ className }: { className?: string }) {
  const t = useTranslations('sync');
  const { engine } = useSync();
  const { status, l, title, detail, extra } = useStatusText();
  const Icon = l.icon;
  return (
    <div role="status" aria-label={t('label')} className={cn('flex items-center gap-2.5 px-2 text-sm', className)}>
      <Icon aria-hidden className={cn('size-4 shrink-0', l.tone, l.spin && 'motion-ok:animate-spin')} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-fg-2">{title}</span>
        {(extra ?? detail) && <span className="block truncate text-xs text-fg-3">{extra ?? detail}</span>}
      </span>
      {(status?.state === 'error' || status?.state === 'offline') && (
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void engine.syncNow()}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

/** Phone top bar: a small cloud that opens the same details. */
export function SyncBadge() {
  const t = useTranslations('sync');
  const { engine } = useSync();
  const { status, l, title, detail, extra } = useStatusText();
  const Icon = l.icon;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t('label')}: ${title}`}
          className="focus-ring relative inline-flex size-10 items-center justify-center rounded-full"
        >
          <Icon aria-hidden className={cn('size-[18px]', l.tone, l.spin && 'motion-ok:animate-spin')} />
          {status && status.pending > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warning shadow-[0_0_8px_var(--color-warning)]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-base font-medium text-fg">{title}</p>
        {extra && <p className="mt-1 text-sm text-fg-2">{extra}</p>}
        {detail && <p className="mt-1 text-sm text-fg-3">{detail}</p>}
        {(status?.state === 'error' || status?.state === 'offline') && (
          <Button size="sm" className="mt-3" icon={<RefreshCw />} onClick={() => void engine.syncNow()}>
            {t('retry')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
