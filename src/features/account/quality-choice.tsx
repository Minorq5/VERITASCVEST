'use client';

import { Gauge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChoiceCard, ChoiceCards } from '@/components/ui/choice-cards';
import { graphicsQualities, type GraphicsQuality } from '@/lib/device';
import type { ConcreteQuality } from '@/lib/graphics/detect';

const STAR_COUNT: Record<GraphicsQuality, number> = { ultra: 30, high: 17, auto: 14, low: 7, off: 0 };

/** Tiny deterministic sky: the same stars on every render. */
function stars(count: number) {
  let seed = 20260929;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({ x: rand() * 56, y: rand() * 40, r: 0.35 + rand() * 0.8, o: 0.35 + rand() * 0.65 }));
}

/** A thumbnail of what each quality level looks like. */
function QualityPreview({ quality }: { quality: GraphicsQuality }) {
  const id = useId();
  const points = useMemo(() => stars(STAR_COUNT[quality]), [quality]);
  const nebula = quality === 'ultra' ? 0.55 : quality === 'high' || quality === 'auto' ? 0.3 : 0;
  return (
    <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-md border border-line">
      <svg viewBox="0 0 56 40" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id={`${id}-n`} cx="0.75" cy="0.2" r="0.8">
            <stop offset="0" stopColor="var(--accent)" stopOpacity={nebula} />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="56" height="40" fill="#070b16" />
        {nebula > 0 && <rect width="56" height="40" fill={`url(#${id}-n)`} />}
        {quality === 'off' && <circle cx="40" cy="44" r="18" fill="#141d33" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="0.8" />}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={quality === 'low' ? p.r * 0.8 : p.r} fill="#e8edfa" opacity={p.o} />
        ))}
      </svg>
      {quality === 'auto' && (
        <span className="absolute inset-0 flex items-center justify-center bg-[rgb(7_11_22/0.35)] text-accent">
          <Gauge aria-hidden className="size-4.5" />
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
          badge={recommended === q ? <Badge tone="accent">{t('onboarding.graphics.recommended')}</Badge> : undefined}
        />
      ))}
    </ChoiceCards>
  );
}
