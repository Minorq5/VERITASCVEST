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
  Repeat,
  Search,
  Settings,
  Sun,
  Timer,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LogoLockup, LogoMark } from '@/components/brand/logo';
import { markVariants } from '@/components/brand/logo-geometry';
import { Button } from '@/components/ui/button';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { Switch } from '@/components/ui/switch';
import { accentPalette, lines, physical, priorities, semantic, surfaces, swatches, text } from '@/design/palette';
import { contrastRatio } from '@/lib/color/contrast';
import { accents } from '@/lib/device';
import { duration, ease } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils/cn';
import { useDeviceSettings } from '@/stores/device-settings';
import { altGolos, altPlexMono, altTektur, altWix } from './alt-fonts';
import { chipGrid, Group, Section, Specimen } from './primitives';

export function BrandSection() {
  const t = useTranslations('design');
  return (
    <Section id="brand" title={t('sections.brand')} lead={t('brand.lead')}>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
        {markVariants.map((variant, i) => (
          <div key={variant} className="flex flex-col gap-6 bg-surface-1 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label-mono text-fg-2">
                {String(i + 1).padStart(2, '0')} · {t(`brand.${variant}`)}
              </p>
              {i === 0 && <span className="label-mono text-accent">{t('brand.recommended')}</span>}
            </div>
            <div className="flex h-52 items-center justify-center">
              <LogoMark size={176} variant={variant} animated />
            </div>
            <p className="min-h-15 text-sm text-fg-2">{t(`brand.${variant}Text`)}</p>
            <div className="flex items-end gap-5 border-t border-line pt-5">
              {[48, 32, 24, 16].map((size) => (
                <Specimen key={size} label={`${size}`} className="items-center">
                  <LogoMark size={size} variant={variant} />
                </Specimen>
              ))}
              <span className="ml-auto flex size-14 items-center justify-center rounded-lg border border-line-strong bg-bg">
                <LogoMark size={36} variant={variant} />
              </span>
            </div>
            <div className="border-t border-line pt-5">
              <LogoLockup size="md" variant={variant} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ColorChip({ name, value, on, note }: { name: string; value: string; on?: string; note?: string }) {
  const t = useTranslations('design.tokens');
  const ratio = on ? contrastRatio(value, on) : null;
  return (
    <div className="flex min-w-0 flex-col self-stretch border border-line-strong bg-surface-1">
      <div className="h-14 border-b border-line-strong" style={{ background: value }} />
      <div className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="truncate text-sm text-fg">{name}</span>
        <span className="font-mono text-xs text-fg-3 uppercase">{value}</span>
        {ratio && <span className="font-mono text-xs text-fg-3">{t('contrast', { ratio: ratio.toFixed(1) })}</span>}
        {note && <span className="text-xs text-fg-3">{note}</span>}
      </div>
    </div>
  );
}

export function ColorSection() {
  const t = useTranslations('design');
  const tAccent = useTranslations('accent');
  const accent = useDeviceSettings((s) => s.accent);
  const setSetting = useDeviceSettings((s) => s.set);
  const on = surfaces['surface-1'];

  return (
    <Section id="color" title={t('sections.color')} lead={t('tokens.lead')}>
      <Group label={t('tokens.surfaces')} className={chipGrid}>
        {Object.entries(surfaces).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} />
        ))}
      </Group>
      <Group label={t('tokens.lines')} className={chipGrid}>
        {Object.entries(lines).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} />
        ))}
      </Group>
      <Group label={t('tokens.text')} className={chipGrid}>
        {Object.entries(text).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} on={on} />
        ))}
      </Group>
      <Group label={t('tokens.physical')} className={chipGrid}>
        {(['amber', 'blue', 'red'] as const).map((name) => (
          <ColorChip key={name} name={name} value={physical[name]} on={on} note={t(`tokens.${name}Note`)} />
        ))}
      </Group>
      <Group label={t('tokens.accents')}>
        <div className="flex w-full flex-col gap-4">
          <ColorSwatches
            value={accent}
            onValueChange={(v) => setSetting('accent', v)}
            label={tAccent('label')}
            swatches={accents.map((a) => ({ value: a, color: accentPalette[a].accent, label: tAccent(a) }))}
          />
          <div className={chipGrid}>
            {accents.map((a) => (
              <ColorChip key={a} name={tAccent(a)} value={accentPalette[a].accent} on={on} />
            ))}
          </div>
        </div>
      </Group>
      <Group label={t('tokens.semantic')} className={chipGrid}>
        {Object.entries(semantic).map(([name, value]) => (
          <ColorChip key={name} name={name} value={value} on={on} />
        ))}
      </Group>
      <Group label={t('tokens.priorities')} className={chipGrid}>
        {Object.entries(priorities).map(([name, value]) => (
          <ColorChip key={name} name={t(`overlays.${name}` as 'overlays.high')} value={value} on={on} />
        ))}
      </Group>
      <Group label={t('tokens.swatches')} className="grid w-full grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-3">
        {Object.entries(swatches).map(([name, value]) => (
          <Specimen key={name} label={name}>
            <span className="h-8 w-full rounded-xs" style={{ background: value }} />
          </Specimen>
        ))}
      </Group>
    </Section>
  );
}

const typeScale = [
  { token: '6xl · 72/72', cls: 'font-display text-4xl font-medium sm:text-6xl', sample: 'word' },
  { token: '4xl · 44/48', cls: 'font-display text-3xl font-medium sm:text-4xl', sample: 'display' },
  { token: '2xl · 26/32', cls: 'font-display text-2xl font-medium', sample: 'h1' },
  { token: 'xl · 22/28', cls: 'font-display text-xl font-medium', sample: 'h2' },
  { token: 'md · 15/24', cls: 'text-md', sample: 'body' },
  { token: 'base · 14/20', cls: 'text-base', sample: 'body' },
  { token: 'sm · 13/20', cls: 'text-sm text-fg-2', sample: 'small' },
  { token: 'label · 11/16', cls: 'label-mono', sample: 'label' },
] as const;

export function TypeSection() {
  const t = useTranslations('design');
  return (
    <Section id="type" title={t('sections.type')}>
      <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-1">
        {typeScale.map((row) => (
          <div key={row.token} className="grid items-baseline gap-2 px-5 py-4 md:grid-cols-[9rem_1fr]">
            <span className="font-mono text-xs text-fg-3">{row.token}</span>
            <span className={cn('min-w-0 text-fg', row.cls)}>{t(`typeSamples.${row.sample}`)}</span>
          </div>
        ))}
        <div className="grid items-baseline gap-2 px-5 py-4 md:grid-cols-[9rem_1fr]">
          <span className="font-mono text-xs text-fg-3">mono</span>
          <span className="font-mono text-3xl text-fg tabular sm:text-5xl">25:00 · 12.10 · VT-0412</span>
        </div>
      </div>
    </Section>
  );
}

export function FontCompareSection() {
  const t = useTranslations('design');
  const headings = [
    { name: 'Geologica', className: 'font-display', chosen: true },
    { name: 'Wix Madefor Display', className: altWix.className },
    { name: 'Tektur', className: altTektur.className },
  ];
  const bodies = [
    { name: 'Onest', className: 'font-sans', chosen: true },
    { name: 'Golos Text', className: altGolos.className },
  ];
  const monos = [
    { name: 'JetBrains Mono', className: 'font-mono', chosen: true },
    { name: 'IBM Plex Mono', className: altPlexMono.className },
  ];
  const Verdict = ({ chosen }: { chosen?: boolean }) => (
    <span className={cn('label-mono', chosen ? 'text-accent' : 'text-fg-3')}>
      {chosen ? t('fontCompare.recommended') : t('fontCompare.alternative')}
    </span>
  );
  return (
    <Section id="fonts" title={t('sections.fonts')} lead={t('fontCompare.lead')}>
      <Group label={t('fontCompare.headingPair')} className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-3">
        {headings.map((font) => (
          <div key={font.name} className="flex h-full flex-col gap-5 bg-surface-1 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-fg">{font.name}</span>
              <Verdict chosen={font.chosen} />
            </div>
            <p className={cn('text-3xl font-medium text-fg', font.className)}>{t('typeSamples.display')}</p>
            <div className="flex flex-col gap-1 border-t border-line pt-4">
              <span className="label-mono">ru</span>
              <p className={cn('text-xl text-fg-2', font.className)}>{t('typeSamples.h1')}</p>
            </div>
            <div lang="bg" className="flex flex-col gap-1 border-t border-line pt-4">
              <span className="label-mono">bg · locl</span>
              <p className={cn('text-xl text-fg-2', font.className)}>{t('typeSamples.bulgarian')}</p>
              <p className={cn('mt-1 text-2xl tracking-wide text-fg', font.className)}>д л ж ф ц щ ю ѝ Д Л Ж</p>
            </div>
            <div className="flex flex-col gap-1 border-t border-line pt-4">
              <span className="label-mono">ru</span>
              <p className={cn('text-2xl tracking-wide text-fg', font.className)}>д л ж ф ц щ ю й Д Л Ж</p>
            </div>
          </div>
        ))}
      </Group>
      <Group label={t('fontCompare.textPair')} className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
        {bodies.map((font) => (
          <div key={font.name} className="flex flex-col gap-4 bg-surface-1 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-fg">{font.name}</span>
              <Verdict chosen={font.chosen} />
            </div>
            <p className={cn('text-base text-fg-2', font.className)}>{t('typeSamples.body')}</p>
            <p lang="bg" className={cn('text-base text-fg-2', font.className)}>
              {t('typeSamples.bulgarian')}
            </p>
          </div>
        ))}
      </Group>
      <Group label={t('fontCompare.monoPair')} className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
        {monos.map((font) => (
          <div key={font.name} className="flex flex-col gap-4 bg-surface-1 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-fg">{font.name}</span>
              <Verdict chosen={font.chosen} />
            </div>
            <p className={cn('text-4xl text-fg tabular', font.className)}>25:00</p>
            <p className={cn('text-sm tracking-[0.08em] text-fg-2 uppercase', font.className)}>
              {t('typeSamples.label')} · 12.10 18:00 · VT-0412 · 2/5
            </p>
          </div>
        ))}
      </Group>
    </Section>
  );
}

export function GridSection() {
  const t = useTranslations('design');
  const steps = [1, 2, 3, 4, 6, 8, 10, 12, 16];
  const radii = [
    ['0', 'rounded-none', ''],
    ['xs · 2', 'rounded-xs', 'label'],
    ['sm · 4', 'rounded-sm', 'button'],
    ['lg · 6', 'rounded-lg', 'menu'],
    ['xl · 8', 'rounded-xl', 'dialog'],
  ] as const;
  const heights = [28, 32, 36, 44];
  return (
    <Section id="grid" title={t('sections.grid')} lead={t('grid.lead')}>
      <Group label={t('grid.spacing')}>
        <div className="flex w-full flex-col gap-2">
          {steps.map((step) => (
            <div key={step} className="flex items-center gap-4">
              <span className="w-20 font-mono text-xs text-fg-3 tabular">{step * 4}px</span>
              <span className="h-2 bg-accent" style={{ width: step * 4 * 2 }} />
            </div>
          ))}
        </div>
      </Group>
      <Group label={t('grid.radius')} className="gap-6">
        {radii.map(([name, cls, use]) => (
          <Specimen key={name} label={use ? `${name} · ${use}` : name}>
            <span className={cn('block size-16 border border-line-bright bg-surface-3', cls)} />
          </Specimen>
        ))}
      </Group>
      <Group label={t('grid.heights')} className="items-end gap-4">
        {heights.map((h) => (
          <Specimen key={h} label={`${h}px`}>
            <span className="flex w-24 items-center rounded-sm border border-line-strong bg-surface-2 px-2 text-sm text-fg-3" style={{ height: h }}>
              {h === 44 ? t('grid.touch') : t('grid.control')}
            </span>
          </Specimen>
        ))}
      </Group>
    </Section>
  );
}

export function DepthSection() {
  const t = useTranslations('design');
  return (
    <Section id="depth" title={t('sections.depth')} lead={t('depth.lead')}>
      <div className="relative h-80 overflow-hidden rounded-xl border border-line bg-bg">
        <div className="absolute inset-6 rounded-xl border border-line bg-surface-1 p-4">
          <span className="label-mono">surface-1 · {t('depth.panel')}</span>
          <div className="absolute inset-x-4 top-12 bottom-4 rounded-lg border border-line-strong bg-surface-2 p-4">
            <span className="label-mono">surface-2 · {t('depth.card')}</span>
            <div className="absolute top-12 left-4 w-60 rounded-lg border border-line-strong bg-surface-3 p-3">
              <span className="label-mono">surface-3 · {t('depth.menu')}</span>
              <div className="mt-2 flex h-8 items-center rounded-xs bg-surface-4 px-2 text-sm text-fg">surface-4 · hover</div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-sm text-fg-3">{t('depth.noShadows')}</p>
    </Section>
  );
}

export function MotionSection() {
  const t = useTranslations('design');
  const [run, setRun] = useState(0);
  const rows = [
    { label: `instant · ${duration.instant * 1000} ms`, transition: { duration: duration.instant, ease: ease.out } },
    { label: `fast · ${duration.fast * 1000} ms`, transition: { duration: duration.fast, ease: ease.out } },
    { label: `base · ${duration.base * 1000} ms`, transition: { duration: duration.base, ease: ease.outExpo } },
    { label: `slow · ${duration.slow * 1000} ms`, transition: { duration: duration.slow, ease: ease.emphasized } },
    { label: `scene · ${duration.cinematic * 1000} ms`, transition: { duration: duration.cinematic, ease: ease.cinematic } },
  ];
  return (
    <Section id="motion" title={t('sections.motion')} lead={t('motionSamples.lead')}>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-1 p-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4">
            <span className="w-40 shrink-0 font-mono text-xs text-fg-2">{row.label}</span>
            <div className="relative h-px flex-1 bg-line-strong">
              <motion.span
                key={`${row.label}-${run}`}
                className="absolute -top-1 size-2 rounded-full bg-accent"
                initial={{ left: '0%' }}
                animate={{ left: 'calc(100% - 8px)' }}
                transition={row.transition}
              />
            </div>
          </div>
        ))}
        <div className="pt-2">
          <Button size="sm" variant="secondary" onClick={() => setRun((r) => r + 1)}>
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
    ['Repeat', Repeat],
    ['Users', Users],
    ['Trash2', Trash2],
    ['Settings', Settings],
    ['LayoutGrid', LayoutGrid],
    ['ListTodo', ListTodo],
    ['CheckCheck', CheckCheck],
    ['Moon', Moon],
  ] as const;
  return (
    <Section id="icons" title={t('sections.icons')} lead={t('icons.lead')}>
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line">
        {lucide.map(([name, Icon]) => (
          <div key={name} className="flex min-w-0 flex-col items-center gap-3 bg-surface-1 px-2 py-4 text-fg-2">
            <Icon className="size-4" />
            <span className="max-w-full truncate font-mono text-xs text-fg-3">{name}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function BackgroundSection() {
  const t = useTranslations('design.background');
  const td = useTranslations('design');
  const cursor = useDeviceSettings((s) => s.cursor);
  const motionMode = useDeviceSettings((s) => s.motion);
  const set = useDeviceSettings((s) => s.set);
  return (
    <Section id="background" title={td('sections.background')} lead={t('lead')}>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
        <div className="flex flex-col gap-2 bg-surface-1 p-5">
          <span className="label-mono">{t('starsLabel')}</span>
          <p className="text-sm text-fg-2">{t('stars')}</p>
        </div>
        <div className="flex flex-col gap-5 bg-surface-1 p-5">
          <Switch
            checked={cursor === 'custom'}
            onCheckedChange={(v) => set('cursor', v ? 'custom' : 'system')}
            label={t('lens')}
            description={t('lensHint')}
          />
          <Switch
            checked={motionMode === 'reduced'}
            onCheckedChange={(v) => set('motion', v ? 'reduced' : 'system')}
            label={t('reduced')}
            description={t('reducedHint')}
          />
        </div>
      </div>
    </Section>
  );
}

export function BansSection() {
  const t = useTranslations('design.bans');
  const td = useTranslations('design');
  const items = ['violet', 'blur', 'radius', 'glow', 'emoji', 'nebula', 'template'] as const;
  return (
    <Section id="bans" title={td('sections.bans')} lead={t('lead')}>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface-1">
        {items.map((item) => (
          <li key={item} className="grid gap-1 px-5 py-3.5 md:grid-cols-[1.25rem_16rem_1fr] md:gap-4">
            <X aria-hidden className="mt-0.5 hidden size-4 text-danger md:block" />
            <span className="text-base text-fg">{t(`${item}.no`)}</span>
            <span className="text-sm text-fg-2">{t(`${item}.instead`)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-fg-3">{t('test')}</p>
    </Section>
  );
}
