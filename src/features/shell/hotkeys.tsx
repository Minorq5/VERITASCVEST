'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { useTaskActions } from '@/features/tasks/data/use-task-actions';
import { useQuickAdd } from '@/features/tasks/quick-add/store';
import { useRouter } from '@/i18n/navigation';
import { isTyping, overlayOpen, useKeydown } from '@/lib/hooks/use-hotkeys';
import { sectionItems } from './nav';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Shortcuts that work everywhere in the app (the rest of the set arrives in stage 11). */
export function ShellHotkeys() {
  const t = useTranslations('tasks.hotkeys');
  const router = useRouter();
  const actions = useTaskActions();
  const openQuickAdd = useQuickAdd((s) => s.setOpen);
  const [help, setHelp] = useState(false);

  useKeydown((event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
      if (isTyping(event) || overlayOpen()) return;
      event.preventDefault();
      void (event.shiftKey ? actions.redo() : actions.undo());
      return;
    }
    if (mod && !event.altKey && event.key.toLowerCase() === 'y' && !isMac()) {
      if (isTyping(event) || overlayOpen()) return;
      event.preventDefault();
      void actions.redo();
      return;
    }
    if (mod || event.altKey || isTyping(event) || overlayOpen()) return;
    if (event.key === 'n' || event.key === 'N' || event.code === 'KeyN') {
      event.preventDefault();
      openQuickAdd(true);
      return;
    }
    if (event.key === '?') {
      event.preventDefault();
      setHelp(true);
      return;
    }
    const digit = /^Digit([1-7])$/.exec(event.code);
    if (digit) {
      const item = sectionItems[Number(digit[1]) - 1];
      if (item) {
        event.preventDefault();
        router.push(item.href);
      }
    }
  });

  const mod = isMac() ? '⌘' : 'Ctrl';
  const rows: [string[], string][] = [
    [['N'], t('newTask')],
    [['1', '…', '7'], t('sections')],
    [['J'], t('next')],
    [['K'], t('previous')],
    [['Enter'], t('open')],
    [['Space'], t('complete')],
    [['X'], t('select')],
    [['Del'], t('remove')],
    [[mod, 'Z'], t('undo')],
    [[mod, 'Shift', 'Z'], t('redo')],
    [['Esc'], t('close')],
    [['?'], t('help')],
  ];

  return (
    <Dialog open={help} onOpenChange={setHelp} title={t('title')} description={t('soon')} size="sm">
      <dl className="flex flex-col divide-y divide-line">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-base text-fg-2">{label}</dt>
            <dd className="flex items-center gap-1">
              {keys.map((k) => (k === '…' ? <span key={k} className="text-fg-3">…</span> : <Kbd key={k}>{k}</Kbd>))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
