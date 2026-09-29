'use client';

import { Gauge, Pause } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ChoiceCard, ChoiceCards } from '@/components/ui/choice-cards';
import { graphicsQualities, type GraphicsQuality } from '@/lib/device';
import type { ConcreteQuality } from '@/lib/graphics/detect';
import { cn } from '@/lib/utils/cn';

/**
 * What each level looks like: the same black hole, rendered by the real
 * shader and cut to the resolution the level draws at (Low is visibly
 * coarser). Off is a still frame; Auto picks one of them.
 */
const THUMB: Record<GraphicsQuality, { src: string; pixelated?: boolean }> = {
  auto: { src: '/cinema/quality-high.webp' },
  ultra: { src: '/cinema/quality-ultra.webp' },
  high: { src: '/cinema/quality-high.webp' },
  low: { src: '/cinema/quality-low.webp', pixelated: true },
  off: { src: '/cinema/quality-high.webp' },
};

function QualityPreview({ quality }: { quality: GraphicsQuality }) {
  const thumb = THUMB[quality];
  const overlay =
    quality === 'auto' ? (
      <Gauge aria-hidden className="size-4" />
    ) : quality === 'off' ? (
      <Pause aria-hidden className="size-4" />
    ) : null;
  return (
    <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-sm border border-line bg-void">
      <Image
        src={thumb.src}
        alt=""
        width={56}
        height={40}
        unoptimized
        className={cn(
          'size-full object-cover',
          thumb.pixelated && '[image-rendering:pixelated]',
          quality === 'off' && 'opacity-60',
        )}
      />
      {overlay && (
        <span className="absolute inset-0 flex items-center justify-center bg-[rgb(5_5_6/0.5)] text-fg">
          {overlay}
        </span>
      )}
    </span>
  );
}

export function QualityChoice({
  value,
  onChange,
  recommended,
  describedBy,
}: {
  value: GraphicsQuality;
  onChange: (value: GraphicsQuality) => void;
  recommended?: ConcreteQuality;
  describedBy?: string;
}) {
  const t = useTranslations();
  return (
    <ChoiceCards
      value={value}
      onValueChange={(v) => onChange(v as GraphicsQuality)}
      aria-label={t('quality.label')}
      aria-describedby={describedBy}
    >
      {graphicsQualities.map((q) => (
        <ChoiceCard
          key={q}
          value={q}
          media={<QualityPreview quality={q} />}
          label={t(`quality.${q}`)}
          description={t(`onboarding.graphics.${q}`)}
          badge={
            recommended === q ? (
              <Badge tone="accent">{t('onboarding.graphics.recommended')}</Badge>
            ) : undefined
          }
        />
      ))}
    </ChoiceCards>
  );
}
