'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/ui/qr-code';
import { Surface } from '@/components/ui/surface';
import type { Profile } from '@/features/account/queries';
import { useClientValue } from '@/lib/hooks/use-client-value';
import { toast } from '@/stores/toasts';

/** The public ID and a QR code: the two ways a friend can find you. */
export function FriendCard({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const origin = useClientValue(() => window.location.origin, '');
  const canShare = useClientValue(() => typeof navigator.share === 'function', false);
  const [copied, setCopied] = useState(false);

  const link = `${origin}/add/${profile.public_id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(profile.public_id);
      setCopied(true);
      toast.success(t('idCopied'));
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <Surface tone="glass" className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
      <div className="flex flex-1 flex-col gap-2">
        <p className="eyebrow">{t('publicId')}</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-medium tracking-[0.08em] text-fg tabular" translate="no">
            {profile.public_id}
          </span>
          <Button variant="ghost" size="sm" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()} aria-label={t('copyId')}>
            <span className="sr-only sm:not-sr-only">{copied ? t('copied') : t('copy')}</span>
          </Button>
        </div>
        <p className="text-sm text-fg-3">{t('qrText')}</p>
        {canShare && origin && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Share2 />}
            className="mt-2 self-start"
            onClick={() => void navigator.share({ title: 'Veritas Tasks', text: t('shareText', { id: profile.public_id }), url: link }).catch(() => undefined)}
          >
            {t('share')}
          </Button>
        )}
      </div>
      <div className="flex justify-center">
        {origin ? (
          <QrCode value={link} size={188} label={t('qrTitle')} className="shadow-lg" />
        ) : (
          <span className="block size-[188px] rounded-xl bg-surface-3" />
        )}
      </div>
    </Surface>
  );
}
