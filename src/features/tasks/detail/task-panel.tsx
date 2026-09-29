'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Drawer } from 'vaul';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { overlayOpen, useKeydown } from '@/lib/hooks/use-hotkeys';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { spring } from '@/lib/motion/tokens';
import { useTaskRoute } from '../shared/use-task-route';
import { TaskDetail } from './task-detail';

/**
 * The open task (`?task=…`). Wide screens: a panel beside the list (docked on
 * very wide ones, over the list on laptops). Phones: a full-height sheet.
 */
export function TaskPanel() {
  const t = useTranslations('tasks.detail');
  const { openId, close } = useTaskRoute();
  const desktop = useMediaQuery('(min-width: 1024px)', true);
  const docked = useMediaQuery('(min-width: 1280px)', true);
  const reduce = useLessMotion();
  const panel = useRef<HTMLElement>(null);

  useKeydown((event) => {
    if (!openId || !desktop || event.key !== 'Escape' || overlayOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.ProseMirror')) return;
    event.preventDefault();
    close();
  });

  // Move focus into the panel when a task opens, so keyboard and screen readers follow.
  useEffect(() => {
    if (openId && desktop) panel.current?.focus({ preventScroll: true });
  }, [openId, desktop]);

  if (!desktop) {
    return (
      <Drawer.Root open={Boolean(openId)} onOpenChange={(open) => !open && close()} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-[rgb(3_5_10/0.7)] backdrop-blur-[3px]" />
          <Drawer.Content
            aria-describedby={undefined}
            className="glass-strong shadow-inset-top fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex h-[94dvh] flex-col rounded-t-2xl border-t border-line-strong shadow-xl outline-none"
          >
            <Drawer.Handle className="!mt-2.5 !mb-1 !h-1.5 !w-10 !shrink-0 !rounded-full !bg-surface-5 !opacity-100" />
            <Drawer.Title className="sr-only">{t('label')}</Drawer.Title>
            {openId && <TaskDetail key={openId} id={openId} onClose={close} />}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <AnimatePresence>
      {openId && (
        <>
          {!docked && (
            <motion.button
              key="scrim"
              type="button"
              aria-label={t('close')}
              tabIndex={-1}
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[var(--z-overlay)] bg-[rgb(3_5_10/0.55)] backdrop-blur-[2px] lg:left-68"
            />
          )}
          <motion.aside
            key="panel"
            ref={panel}
            tabIndex={-1}
            aria-label={t('label')}
            initial={reduce ? { opacity: 0 } : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 48, opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : spring.smooth}
            className="glass-strong shadow-inset-top fixed inset-y-0 right-0 z-[var(--z-overlay)] flex w-[min(var(--panel-w),100vw)] flex-col border-l border-line-strong shadow-xl outline-none"
          >
            <TaskDetail key={openId} id={openId} onClose={close} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
