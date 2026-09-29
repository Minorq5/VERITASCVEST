'use client';

import { useTranslations } from 'next-intl';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { QuickAdd } from './quick-add';
import { useQuickAdd } from './store';

/** "+" and N: the smart input over any screen; the task goes to the list on screen. */
export function QuickAddDialog() {
  const t = useTranslations('tasks');
  const open = useQuickAdd((s) => s.open);
  const scope = useQuickAdd((s) => s.scope);
  const setOpen = useQuickAdd((s) => s.setOpen);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} title={t('quickAdd.label')} description={t('quickAdd.syntax')} size="lg">
      {open && <QuickAdd scope={scope ?? { kind: 'section', section: 'inbox' }} autoFocus onCreated={() => setOpen(false)} />}
    </ResponsiveDialog>
  );
}
