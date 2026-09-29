'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { FormAlert } from '@/features/auth/auth-card';
import { forgetDevice } from '@/features/shell/sign-out';
import { useRouter } from '@/i18n/navigation';
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors';
import { useGuardedSubmit } from '@/lib/hooks/use-guarded-submit';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toasts';

export function DeleteAccountDialog({ username }: { username: string }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const { pending, run } = useGuardedSubmit();
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!matches) return;
    void run(async () => {
      setError(null);
      const supabase = getSupabase();
      const { error: invokeError } = await supabase.functions.invoke('delete-account', {
        body: { confirm: typed.trim() },
      });
      if (invokeError) {
        setError(
          invokeError.name === 'FunctionsFetchError' ? 'network' : authErrorKey(invokeError),
        );
        return;
      }
      // The account is gone; the local session and the device copy only need forgetting.
      const userId = useSession.getState().user?.id;
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      await forgetDevice(userId);
      queryClient.clear();
      toast.success(t('settings.account.deleted'));
      router.replace('/');
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setTyped('');
          setError(null);
        }
      }}
      trigger={
        <Button variant="danger" size="sm" icon={<Trash2 />}>
          {t('settings.account.delete')}
        </Button>
      }
      title={t('settings.account.delete')}
      description={t('settings.account.deleteText')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            type="submit"
            form="delete-account"
            disabled={!matches}
            loading={pending}
          >
            {t('settings.account.deleteButton')}
          </Button>
        </>
      }
    >
      <form id="delete-account" noValidate onSubmit={submit} className="flex flex-col gap-4">
        {error && <FormAlert>{t(`auth.errors.${error}`)}</FormAlert>}
        <Field
          label={t.rich('settings.account.deleteConfirmLabel', {
            username,
            name: (chunks) => (
              <span className="font-mono font-semibold break-all text-fg">{chunks}</span>
            ),
          })}
        >
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}
