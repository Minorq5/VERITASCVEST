'use client';

import {
  Bell,
  Calendar,
  CheckCheck,
  Flag,
  Folder,
  Hash,
  Inbox,
  LayoutGrid,
  ListTodo,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AstronautIcon,
  CometIcon,
  ConstellationIcon,
  GalaxyIcon,
  PlanetIcon,
  RankIcon,
  ShipIcon,
  StarGlintIcon,
  SupernovaIcon,
} from '@/components/brand/icons';
import { LogoLockup, LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { contrastRatio } from '@/lib/color/contrast';
import { accents } from '@/lib/device';
import { duration, ease, spring } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils/cn';
import { accentPalette, priorities, semantic, surfaces, swatches, text } from '@/design/palette';
import { useDeviceSettings } from '@/stores/device-settings';
import { altGeologica, altGolos, altInter, altManrope, altMartian } from './alt-fonts';
import { chipGrid, Group, Section, Specimen } from './primitives';

export function BrandSection() {
  const t = useTranslations('design');
  return (
    <Section id="brand" title={t('sections.brand')}>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-line bg-[radial-gradient(ellipse_at_50%_70%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_65%)]">
          <LogoMark size={176} detail="full" animated />
        </div>
        <div className="grid grid-rows-2 gap-4">
          <div className="flex items-center justify-center rounded-xl border border-line bg-surface-1 px-6">
            <LogoLockup size="lg" />
          </div>
          <div className="flex items-end justify-center gap-8 rounded-xl border border-line bg-surface-1 px-6 pb-6">
            {[64, 40, 24, 16].map((size) => (
              <Specimen key={size} label={`${size}px`} className="items-center">
                <LogoMark size={size} />
              </Specimen>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ColorChip({ name, value, on }: { name: string; value: string; on?: string }) {
  const t = useTranslations('design.tokens');
  const ratio = on ? contrastRatio(value, on) : null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className="shadow-inset-top h-16 rounded-md border border-line-strong"
        style={{ background: value }}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-fg">{name}</span>
        <span className="font-mono text-xs text-fg-3 uppercase">{value}</span>
        {ratio && (
          <span className="font-mono text-xs text-fg-3">
            {t('contrast', { ratio: ratio.toFixed(1) })}
          </span>
        )}
      </div>
    </div>
  );
}

export function ColorSection() {
  const t = useTranslations('design');
  const tAccent = useTranslations('accent');
  const accent = useDeviceSettings((s) => s.accent);
  const setSetting = useDeviceSettings((s) => s.set);

  return (
    <Section id="color" title={t('sections.color')}>
      <Group label={t('tokens.surfaces')} className={chipGrid}>
        {Object.entries(surfaces).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} />
        ))}
      </Group>
      <Group label={t('tokens.text')} className={chipGrid}>
        {Object.entries(text).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} on={surfaces['surface-2']} />
        ))}
      </Group>
      <Group label={t('tokens.accents')}>
        <div className="flex w-full flex-col gap-5">
          <ColorSwatches
            value={accent}
            onValueChange={(v) => setSetting('accent', v)}
            label={tAccent('label')}
            size={40}
            swatches={accents.map((a) => ({
              value: a,
              color: accentPalette[a].accent,
              label: tAccent(a),
            }))}
          />
          <div className={chipGrid}>
            {accents.map((a) => (
              <ColorChip
                key={a}
                name={tAccent(a)}
                value={accentPalette[a].accent}
                on={surfaces['surface-2']}
              />
            ))}
          </div>
        </div>
      </Group>
      <Group label={t('tokens.semantic')} className={chipGrid}>
        {Object.entries(semantic).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} on={surfaces['surface-2']} />
        ))}
      </Group>
      <Group label={t('tokens.priorities')} className={chipGrid}>
        {Object.entries(priorities).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} on={surfaces['surface-2']} />
        ))}
      </Group>
      <Group
        label={t('tokens.swatches')}
        className="grid w-full grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-3"
      >
        {Object.entries(swatches).map(([name, value]) => (
          <Specimen key={name} label={name} className="items-center">
            <span
              className="size-10 rounded-full"
              style={{
                background: `radial-gradient(circle at 32% 28%, color-mix(in oklab, ${value} 55%, white), ${value} 55%, color-mix(in oklab, ${value} 60%, black))`,
                boxShadow: `0 0 18px -6px ${value}`,
              }}
            />
          </Specimen>
        ))}
      </Group>
    </Section>
  );
}

const typeScale = [
  { token: 'text-6xl', cls: 'font-display text-4xl font-semibold sm:text-6xl', sample: 'word' },
  { token: 'text-4xl', cls: 'font-display text-3xl font-semibold sm:text-4xl', sample: 'display' },
  { token: 'text-2xl', cls: 'font-display text-2xl font-semibold', sample: 'h1' },
  { token: 'text-xl', cls: 'text-xl font-semibold', sample: 'h2' },
  { token: 'text-lg', cls: 'text-lg', sample: 'body' },
  { token: 'text-base', cls: 'text-base', sample: 'body' },
  { token: 'text-sm', cls: 'text-sm text-fg-2', sample: 'small' },
  { token: 'text-xs', cls: 'text-xs text-fg-3', sample: 'small' },
] as const;

export function TypeSection() {
  const t = useTranslations('design');
  return (
    <Section id="type" title={t('sections.type')}>
      <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-1">
        {typeScale.map((row) => (
          <div
            key={row.token}
            className="grid items-baseline gap-2 px-5 py-4 md:grid-cols-[8rem_1fr]"
          >
            <span className="font-mono text-xs text-fg-3">{row.token}</span>
            <span className={cn('min-w-0 text-fg', row.cls)}>{t(`typeSamples.${row.sample}`)}</span>
          </div>
        ))}
        <div className="grid items-baseline gap-2 px-5 py-4 md:grid-cols-[8rem_1fr]">
          <span className="font-mono text-xs text-fg-3">font-mono</span>
          <span className="font-mono tabular text-3xl font-medium text-fg sm:text-5xl">
            25:00 · 1 284 · 73%
          </span>
        </div>
        <div className="grid items-baseline gap-2 px-5 py-4 md:grid-cols-[8rem_1fr]">
          <span className="font-mono text-xs text-fg-3">lang=&quot;bg&quot;</span>
          <span lang="bg" className="flex flex-col gap-2">
            <span className="font-display text-2xl font-semibold text-fg">
              {t('typeSamples.bulgarian')}
            </span>
            <span className="text-lg text-fg-2">{t('typeSamples.bulgarian')}</span>
          </span>
        </div>
      </div>
    </Section>
  );
}

export function FontCompareSection() {
  const t = useTranslations('design');
  const pangram = t('typeSamples.pangram');
  const rows = [
    {
      label: t('fontCompare.headingPair'),
      items: [
        { name: 'Unbounded', chosen: true, className: 'font-display font-semibold' },
        { name: 'Geologica', className: cn(altGeologica.className, 'font-bold') },
        { name: 'Manrope', className: cn(altManrope.className, 'font-extrabold') },
      ],
      size: 'text-2xl leading-tight',
      cols: 'md:grid-cols-3',
      text: t('typeSamples.display'),
    },
    {
      label: t('fontCompare.textPair'),
      items: [
        { name: 'Onest', chosen: true, className: 'font-sans' },
        { name: 'Manrope', className: altManrope.className },
        { name: 'Golos Text', className: altGolos.className },
        { name: 'Inter', className: altInter.className },
      ],
      size: 'text-base',
      cols: 'md:grid-cols-2 xl:grid-cols-4',
      text: `${t('typeSamples.body')} ${pangram}`,
    },
    {
      label: t('fontCompare.monoPair'),
      items: [
        { name: 'JetBrains Mono', chosen: true, className: 'font-mono' },
        { name: 'Martian Mono', className: altMartian.className },
      ],
      size: 'text-3xl whitespace-nowrap',
      cols: 'md:grid-cols-2',
      text: '25:00 · 1284',
    },
  ];
  return (
    <Section id="fonts" title={t('sections.fonts')}>
      {rows.map((row) => (
        <Group
          key={row.label}
          label={row.label}
          className={cn('grid w-full grid-cols-1 gap-4', row.cols)}
        >
          {row.items.map((item) => (
            <div
              key={item.name}
              className={cn(
                'flex h-full flex-col gap-4 rounded-lg border p-5',
                item.chosen
                  ? 'border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-accent/[0.06] shadow-glow-sm'
                  : 'border-line bg-surface-1',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg">{item.name}</span>
                <span
                  className={cn('text-xs font-semibold', item.chosen ? 'text-accent' : 'text-fg-3')}
                >
                  {item.chosen ? t('fontCompare.chosen') : t('fontCompare.alternative')}
                </span>
              </div>
              <p className={cn('tabular break-words text-fg', row.size, item.className)}>
                {row.text}
              </p>
            </div>
          ))}
        </Group>
      ))}
    </Section>
  );
}

export function SpacingSection() {
  const t = useTranslations('design');
  const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
  const radii = [
    ['xs', 'rounded-xs'],
    ['sm', 'rounded-sm'],
    ['md', 'rounded-md'],
    ['lg', 'rounded-lg'],
    ['xl', 'rounded-xl'],
    ['2xl', 'rounded-2xl'],
    ['full', 'rounded-full'],
  ] as const;
  return (
    <>
      <Section id="spacing" title={t('sections.spacing')}>
        <div className="flex flex-col gap-2.5">
          {steps.map((step) => (
            <div key={step} className="flex items-center gap-4">
              <span className="w-24 font-mono text-xs text-fg-3">
                {step} · {step * 4}px
              </span>
              <span
                className="h-3 rounded-full bg-[linear-gradient(90deg,var(--accent-lo),var(--accent))]"
                style={{ width: step * 4 * 2 }}
              />
            </div>
          ))}
        </div>
      </Section>
      <Section id="radius" title={t('sections.radius')}>
        <div className="flex flex-wrap gap-6">
          {radii.map(([name, cls]) => (
            <Specimen key={name} label={name} className="items-center">
              <span
                className={cn(
                  'shadow-inset-top size-20 border border-line-bright bg-surface-3',
                  cls,
                )}
              />
            </Specimen>
          ))}
        </div>
      </Section>
    </>
  );
}

export function DepthSection() {
  const t = useTranslations('design');
  return (
    <Section id="depth" title={t('sections.depth')}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(['surface-1', 'surface-2', 'surface-3', 'surface-4', 'surface-5'] as const).map(
          (s, i) => (
            <div
              key={s}
              className="shadow-inset-top flex h-24 items-end rounded-lg border border-line p-4"
              style={{
                background: surfaces[s],
                boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.05), 0 ${4 + i * 6}px ${12 + i * 12}px -${6 + i * 2}px rgb(0 0 0 / 0.7)`,
              }}
            >
              <span className="font-mono text-xs text-fg-2">{s}</span>
            </div>
          ),
        )}
      </div>
      <div className="relative grid gap-4 overflow-hidden rounded-xl border border-line p-6 sm:grid-cols-3 sm:p-10">
        <div className="pointer-events-none absolute top-1/2 left-[8%] size-40 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--accent),transparent_68%)] opacity-80" />
        <div className="pointer-events-none absolute top-2 left-[42%] size-36 rounded-full bg-[radial-gradient(circle,#b294ff,transparent_68%)] opacity-70" />
        <div className="pointer-events-none absolute right-[12%] bottom-[-2rem] size-44 rounded-full bg-[radial-gradient(circle,#ffb547,transparent_68%)] opacity-45" />
        <div className="shadow-inset-top relative rounded-lg border border-line-strong p-5 shadow-lg glass">
          <p className="text-sm font-medium text-fg">glass</p>
          <p className="mt-1 text-sm text-fg-2">blur 20px · 62%</p>
        </div>
        <div className="shadow-inset-top relative rounded-lg border border-line-strong p-5 shadow-lg glass-strong">
          <p className="text-sm font-medium text-fg">glass-strong</p>
          <p className="mt-1 text-sm text-fg-2">blur 28px · 86%</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="rounded-md bg-surface-3 px-3 py-2 text-sm shadow-glow-sm">glow-sm</span>
          <span className="rounded-md bg-surface-3 px-3 py-2 text-sm shadow-glow-md">glow-md</span>
          <span className="rounded-md bg-surface-3 px-3 py-2 text-sm shadow-glow-lg">glow-lg</span>
        </div>
      </div>
    </Section>
  );
}

export function MotionSection() {
  const t = useTranslations('design');
  const [run, setRun] = useState(0);
  const rows = [
    {
      label: t('motionSamples.instant'),
      transition: { duration: duration.instant, ease: ease.out },
    },
    { label: t('motionSamples.fast'), transition: { duration: duration.fast, ease: ease.out } },
    { label: t('motionSamples.base'), transition: { duration: duration.base, ease: ease.outExpo } },
    {
      label: t('motionSamples.slow'),
      transition: { duration: duration.slow, ease: ease.emphasized },
    },
    { label: t('motionSamples.cinematic'), transition: { duration: 1.6, ease: ease.cinematic } },
    { label: 'spring.snappy', transition: spring.snappy },
    { label: 'spring.bouncy', transition: spring.bouncy },
  ];
  return (
    <Section id="motion" title={t('sections.motion')}>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-1 p-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4">
            <span className="w-44 shrink-0 text-sm text-fg-2">{row.label}</span>
            <div className="relative h-8 flex-1 rounded-full bg-surface-3">
              <motion.span
                key={`${row.label}-${run}`}
                className="absolute top-1 size-6 rounded-full bg-accent shadow-glow-sm"
                initial={{ left: '0%', x: 4 }}
                animate={{ left: '100%', x: -28 }}
                transition={row.transition}
              />
            </div>
          </div>
        ))}
        <div>
          <Button size="sm" onClick={() => setRun((r) => r + 1)}>
            {t('motionSamples.replay')}
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function IconsSection() {
  const t = useTranslations('design');
  const lucide = [
    ['Inbox', Inbox],
    ['Sun', Sun],
    ['Calendar', Calendar],
    ['Flag', Flag],
    ['Hash', Hash],
    ['Folder', Folder],
    ['Search', Search],
    ['Bell', Bell],
    ['Timer', Timer],
    ['Users', Users],
    ['Trash2', Trash2],
    ['Settings', Settings],
    ['LayoutGrid', LayoutGrid],
    ['ListTodo', ListTodo],
    ['CheckCheck', CheckCheck],
    ['Moon', Moon],
    ['Sparkles', Sparkles],
  ] as const;
  const brand = [
    ['StarGlint', StarGlintIcon],
    ['Planet', PlanetIcon],
    ['Constellation', ConstellationIcon],
    ['Comet', CometIcon],
    ['Galaxy', GalaxyIcon],
    ['Supernova', SupernovaIcon],
    ['Astronaut', AstronautIcon],
    ['Rank', RankIcon],
    ['Ship', ShipIcon],
  ] as const;
  const Cell = ({
    name,
    children,
    accent,
  }: {
    name: string;
    children: React.ReactNode;
    accent?: boolean;
  }) => (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center gap-3 rounded-lg border border-line bg-surface-1 px-2 py-4 [&_svg]:size-6',
        accent ? 'text-accent' : 'text-fg',
      )}
    >
      {children}
      <span className="max-w-full truncate font-mono text-xs text-fg-3">{name}</span>
    </div>
  );
  return (
    <Section id="icons" title={t('sections.icons')}>
      <Group
        label="Veritas"
        className="grid w-full grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3"
      >
        {brand.map(([name, Icon]) => (
          <Cell key={name} name={name} accent>
            <Icon />
          </Cell>
        ))}
      </Group>
      <Group
        label="Lucide"
        className="grid w-full grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3"
      >
        {lucide.map(([name, Icon]) => (
          <Cell key={name} name={name}>
            <Icon strokeWidth={1.75} />
          </Cell>
        ))}
      </Group>
    </Section>
  );
}
