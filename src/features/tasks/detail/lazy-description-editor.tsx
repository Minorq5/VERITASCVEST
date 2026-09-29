'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DescriptionEditorProps } from './description-editor';

type EditorComponent = ComponentType<DescriptionEditorProps>;

let loaded: EditorComponent | null = null;
let loading: Promise<EditorComponent> | null = null;

/**
 * The rich-text editor is a separate download. It is fetched in the
 * background soon after the app opens, so a task opened later (offline too)
 * has it at once; a failed download is tried again when the network is back.
 */
export function loadDescriptionEditor(): Promise<EditorComponent> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import('./description-editor').then(
    (module) => (loaded = module.default),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export function LazyDescriptionEditor({ text, ...props }: DescriptionEditorProps & { text: string }) {
  const t = useTranslations('tasks.detail');
  const [Editor, setEditor] = useState<EditorComponent | null>(() => loaded);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Editor) return;
    let alive = true;
    const attempt = () =>
      loadDescriptionEditor().then(
        (component) => alive && setEditor(() => component),
        () => alive && setFailed(true),
      );
    void attempt();
    const online = () => {
      setFailed(false);
      void attempt();
    };
    window.addEventListener('online', online);
    return () => {
      alive = false;
      window.removeEventListener('online', online);
    };
  }, [Editor]);

  if (Editor) return <Editor {...props} />;
  if (!failed) return <Skeleton className="h-28 rounded-lg" />;
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <p className="text-base whitespace-pre-wrap text-fg-2">{text || '—'}</p>
      <p className="mt-2 text-sm text-fg-3">{t('descriptionOffline')}</p>
    </div>
  );
}
