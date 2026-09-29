import { Flame, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** A static progress ring, drawn like the app's own (1.5 px, butt caps). */
function Ring({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  const size = 18;
  const r = (size - 1.5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-surface-5)"
        strokeWidth={1.5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={`${c * value} ${c}`}
      />
    </svg>
  );
}

/** The completion ring of a row; done: filled with light, a black point in the centre. */
function Check({
  color,
  done = false,
  children,
}: {
  color?: string;
  done?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
        done && 'border-accent bg-accent',
      )}
      style={done ? undefined : { borderColor: color ?? 'var(--color-line-bright)', color }}
    >
      {done && <span className="size-[36%] rounded-full bg-bg" />}
      {children}
    </span>
  );
}

function Row({
  check,
  title,
  meta,
  progress,
  done = false,
}: {
  check: ReactNode;
  title: string;
  meta?: ReactNode;
  progress?: ReactNode;
  done?: boolean;
}) {
  return (
    <li className="flex min-h-11 items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
      <span className="flex h-5 items-center">{check}</span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-base',
            done ? 'text-fg-3 line-through decoration-fg-4' : 'text-fg',
          )}
        >
          {title}
        </span>
        {meta && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[0.6875rem] leading-4 tracking-[0.02em] text-fg-3">
            {meta}
          </span>
        )}
      </span>
      {progress && (
        <span className="flex shrink-0 items-center gap-2 pt-px font-mono tabular text-xs text-fg-2">
          {progress}
        </span>
      )}
    </li>
  );
}

/**
 * A real piece of the Today screen, drawn with the app's own proportions and
 * readings: rings, times, tags. Static: the landing does not load the planner.
 */
export async function AppPreview({ className }: { className?: string }) {
  const t = await getTranslations('home.preview');
  const due = 'tracking-[0.06em] uppercase';
  return (
    <figure
      className={cn('overflow-hidden rounded-md border border-line-strong bg-surface-1', className)}
    >
      <figcaption className="sr-only">{t('label')}</figcaption>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="label-mono">{t('heading')}</span>
        <span className="font-mono tabular text-xs text-fg-2">{t('count')}</span>
      </div>
      <ul>
        <Row
          check={<Check color="var(--color-prio-high)" />}
          title={t('report')}
          meta={
            <>
              <span className={cn(due, 'text-danger')}>{t('reportDue')}</span>
              <span className="text-[color:var(--color-swatch-blue)]">{t('reportTag')}</span>
            </>
          }
        />
        <Row
          check={<Check />}
          title={t('run')}
          meta={
            <>
              <span className={cn(due, 'text-fg-2')}>{t('runDue')}</span>
              <span className="text-[color:var(--color-swatch-gold)]">{t('runTag')}</span>
            </>
          }
          progress={
            <>
              {t('runProgress')}
              <Ring value={25 / 45} color="var(--color-swatch-blue)" />
            </>
          }
        />
        <Row
          check={<Check />}
          title={t('book')}
          meta={<span className={cn(due, 'text-fg-2')}>{t('bookDue')}</span>}
          progress={
            <>
              {t('bookProgress')}
              <Ring value={124 / 300} />
            </>
          }
        />
        <Row
          check={
            <Check color="var(--color-swatch-gold)">
              <Plus className="size-3" strokeWidth={2} />
            </Check>
          }
          title={t('water')}
          progress={
            <>
              {t('waterProgress')}
              <Ring value={5 / 8} color="var(--color-swatch-gold)" />
            </>
          }
        />
        <Row
          check={<Check done />}
          title={t('letters')}
          done
          meta={
            <span className="inline-flex items-center gap-1">
              <Flame aria-hidden className="size-3 text-accent" />
              {t('lettersDone')}
            </span>
          }
        />
      </ul>
    </figure>
  );
}
