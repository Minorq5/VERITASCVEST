'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

/** "Delete forever" and "Empty trash" always ask first: there is no undo. */
export function ConfirmPurge({
  ids,
  title,
  emptying,
  onClose,
  onConfirm,
}: {
  ids: string[] | null;
  title: string | null;
  emptying: boolean;
  onClose: () => void;
  onConfirm: (ids: string[], emptying: boolean) => Promise<void>;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const count = ids?.length ?? 0;
  return (
    <ResponsiveDialog
      open={ids !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
      title={emptying ? t('tasks.confirm.emptyTrashTitle') : t('tasks.confirm.purgeTitle')}
      description={
        emptying
          ? t('tasks.confirm.emptyTrashText', { count })
          : count === 1 && title
            ? t('tasks.confirm.purgeText', { title })
            : t('tasks.confirm.purgeManyText', { count })
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 />}
            loading={busy}
            onClick={async () => {
              if (!ids) return;
              setBusy(true);
              try {
                await onConfirm(ids, emptying);
              } finally {
                setBusy(false);
              }
            }}
          >
            {emptying ? t('tasks.actions.emptyTrash') : t('tasks.actions.deleteForever')}
          </Button>
        </>
      }
    />
  );
}
