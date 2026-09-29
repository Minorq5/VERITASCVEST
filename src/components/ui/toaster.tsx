'use client';

import { AlertTriangle, CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/lib/motion/tokens';
import { useToasts, type ToastItem, type ToastTone } from '@/stores/toasts';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

const toneIcon: Record<ToastTone, React.ReactNode> = {
  info: <Info className="text-info" />,
  success: <CircleCheck className="text-success" />,
  warning: <AlertTriangle className="text-warning" />,
  error: <CircleAlert className="text-danger" />,
};

const VISIBLE = 3;

export function Toaster() {
  const t = useTranslations('a11y');
  const toasts = useToasts((s) => s.toasts);
  const [expanded, setExpanded] = useState(false);
  const ordered = [...toasts].reverse(); // newest first

  return (
    <section
      aria-label={t('notifications')}
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex justify-center px-4',
        'bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 sm:justify-end sm:px-6',
      )}
    >
      <ol
        className="pointer-events-auto relative flex w-full max-w-[420px] flex-col items-stretch"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
      >
        <AnimatePresence initial={false}>
          {ordered.map((item, index) => (
            <ToastCard
              key={item.id}
              item={item}
              index={index}
              expanded={expanded}
              hidden={index >= VISIBLE}
            />
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

function ToastCard({
  item,
  index,
  expanded,
  hidden,
}: {
  item: ToastItem;
  index: number;
  expanded: boolean;
  hidden: boolean;
}) {
  const t = useTranslations('a11y');
  const dismiss = useToasts((s) => s.dismiss);
  const reduce = useLessMotion();
  const paused = expanded;
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  // Auto-dismiss that pauses while the person is reading (hover/focus).
  useEffect(() => {
    if (!Number.isFinite(item.duration)) return;
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.id, item.duration, dismiss]);

  const collapsedOffset = index * 10;
  const collapsedScale = 1 - index * 0.05;

  return (
    <motion.li
      layout={!reduce}
      role={item.tone === 'error' ? 'alert' : 'status'}
      aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={
        reduce
          ? { opacity: hidden ? 0 : 1 }
          : {
              opacity: hidden ? 0 : 1,
              y: expanded ? 0 : -collapsedOffset,
              scale: expanded ? 1 : collapsedScale,
            }
      }
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, transition: { duration: 0.18 } }}
      transition={spring.smooth}
      drag={reduce ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) dismiss(item.id);
      }}
      style={{ zIndex: 50 - index, pointerEvents: hidden ? 'none' : undefined }}
      className={cn(
        'shadow-inset-top relative mt-2 flex items-start gap-3 rounded-lg border border-line-strong bg-[rgb(19_26_43/0.96)] p-3 pr-1.5 shadow-lg backdrop-blur-xl',
        '[&_svg]:size-5 [&_svg]:shrink-0',
        !expanded && index > 0 && 'absolute inset-x-0 bottom-0',
      )}
    >
      <span className="mt-0.5">{toneIcon[item.tone]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <p className="text-base font-medium text-fg">{item.title}</p>
        {item.description && <p className="text-sm text-fg-2">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
          className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-accent focus-ring transition-colors hover-ok:bg-surface-4"
        >
          {item.countdown && Number.isFinite(item.duration) && (
            <Countdown duration={item.duration} paused={paused} />
          )}
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label={t('dismissNotification')}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-3 focus-ring transition-colors hover-ok:bg-surface-4 hover-ok:text-fg [&_svg]:!size-4"
      >
        <X />
      </button>
    </motion.li>
  );
}

/** A ring that empties as the undo window closes. */
function Countdown({ duration, paused }: { duration: number; paused: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="!size-4 -rotate-90" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={2}
      />
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        style={{
          animation: `countdown ${duration}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </svg>
  );
}
