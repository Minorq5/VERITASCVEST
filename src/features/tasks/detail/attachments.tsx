'use client';

import { ChevronLeft, ChevronRight, Download, FileText, Paperclip, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Spinner } from '@/components/ui/spinner';
import { useSync } from '@/features/sync/sync-provider';
import type { AttachmentRow, TaskRow } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toasts';
import type { TaskActions } from '../data/use-task-actions';

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = 'attachments';

// Signed links to private files, reused until shortly before they expire.
const urls = new Map<string, { url: string; expires: number }>();

async function signedUrl(path: string): Promise<string | null> {
  const cached = urls.get(path);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  urls.set(path, { url: data.signedUrl, expires: Date.now() + 3600_000 });
  return data.signedUrl;
}

function useSignedUrl(path: string | null) {
  const [state, setState] = useState<{ path: string | null; url: string | null }>({ path: null, url: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    void signedUrl(path).then((url) => alive && setState({ path, url }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state.path === path ? state.url : null;
}

function formatSize(bytes: number, locale: string) {
  const units = ['B', 'KB', 'MB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v)} ${units[i]}`;
}

const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-120) || 'file';

/** A small WebP preview (max 480 px) so lists never download full photos. */
async function thumbnail(file: File): Promise<{ blob: Blob | null; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { blob, ...size };
  } catch {
    return null;
  }
}

function Thumb({ attachment, onOpen }: { attachment: AttachmentRow; onOpen: () => void }) {
  const url = useSignedUrl(attachment.thumb_path ?? attachment.storage_path);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring group/thumb relative aspect-square overflow-hidden rounded-sm border border-line-strong bg-surface-2"
      aria-label={attachment.file_name}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- private signed URL, not optimisable
        <img src={url} alt="" className="size-full object-cover transition-opacity duration-200 group-hover/thumb:opacity-85" loading="lazy" />
      ) : (
        <span className="flex size-full items-center justify-center">
          <Spinner className="size-4" />
        </span>
      )}
    </button>
  );
}

function Gallery({ images, index, onIndex, onClose }: { images: AttachmentRow[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const t = useTranslations('tasks.attachments');
  const ta = useTranslations('a11y');
  const current = images[index];
  const url = useSignedUrl(current?.storage_path ?? null);
  const [zoom, setZoom] = useState(false);
  const touch = useRef<number | null>(null);
  const go = (delta: number) => {
    setZoom(false);
    onIndex((index + delta + images.length) % images.length);
  };
  return (
    <D.Root open onOpenChange={(open) => !open && onClose()}>
      <D.Portal>
        <D.Overlay className="scrim-anim fixed inset-0 z-[var(--z-modal)] bg-[rgb(2_2_3/0.92)]" />
        <D.Content
          className="fixed inset-0 z-[var(--z-modal)] flex flex-col outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
          onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touch.current;
            const end = e.changedTouches[0]?.clientX;
            touch.current = null;
            if (start == null || end == null || zoom) return;
            if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
          }}
        >
          <D.Title className="sr-only">{current?.file_name}</D.Title>
          <D.Description className="sr-only">{t('title')}</D.Description>
          <div className="flex items-center gap-2 p-3 text-fg">
            <span className="min-w-0 flex-1 truncate text-sm">
              {current?.file_name} · {index + 1}/{images.length}
            </span>
            <IconButton label={zoom ? t('zoomOut') : t('zoomIn')} icon={zoom ? <ZoomOut /> : <ZoomIn />} onClick={() => setZoom(!zoom)} />
            {url && (
              <IconButton label={t('download')} icon={<Download />} onClick={() => window.open(url, '_blank', 'noopener')} />
            )}
            <D.Close asChild>
              <IconButton label={ta('closeDialog')} icon={<X />} />
            </D.Close>
          </div>
          <div className={cn('relative flex flex-1 items-center justify-center', zoom ? 'overflow-auto' : 'overflow-hidden p-4')}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- private signed URL
              <img
                src={url}
                alt={current?.file_name ?? ''}
                onClick={() => setZoom(!zoom)}
                className={cn('select-none', zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')}
              />
            ) : (
              <Spinner />
            )}
            {images.length > 1 && (
              <>
                <IconButton variant="secondary" label={t('previous')} icon={<ChevronLeft />} onClick={() => go(-1)} className="absolute left-3" />
                <IconButton variant="secondary" label={t('next')} icon={<ChevronRight />} onClick={() => go(1)} className="absolute right-3" />
              </>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Attachments({ task, attachments, readOnly, actions }: { task: TaskRow; attachments: AttachmentRow[]; readOnly: boolean; actions: TaskActions }) {
  const t = useTranslations('tasks.attachments');
  const tc = useTranslations('tasks');
  const { engine } = useSync();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [gallery, setGallery] = useState<number | null>(null);
  const images = attachments.filter((a) => a.mime.startsWith('image/'));
  const files = attachments.filter((a) => !a.mime.startsWith('image/'));
  const locale = useLocale();

  const upload = async (list: FileList | File[]) => {
    // Copy the list first: the browser empties an input's (or a drop's) file
    // list as soon as the event is over, and the upload waits for the sync.
    const files = Array.from(list);
    if (readOnly || files.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.warning(t('offline'));
      return;
    }
    // The server must know the task before files can be attached to it.
    await engine.syncNow({ pull: false });
    const supabase = getSupabase();
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast.error(t('tooLarge', { name: file.name }));
        continue;
      }
      const id = newId();
      const base = `${task.id}/${id}`;
      const path = `${base}/${safeName(file.name)}`;
      setUploading((u) => [...u, file.name]);
      try {
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (error) {
          toast.error(/quota|row-level|policy|403/i.test(error.message) ? t('quota') : t('failed', { name: file.name }));
          continue;
        }
        let thumbPath: string | null = null;
        let size: { width: number; height: number } | null = null;
        if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
          const thumb = await thumbnail(file);
          if (thumb) {
            size = { width: thumb.width, height: thumb.height };
            if (thumb.blob) {
              const tp = `${base}/thumb.webp`;
              const res = await supabase.storage.from(BUCKET).upload(tp, thumb.blob, { contentType: 'image/webp', upsert: false });
              if (!res.error) thumbPath = tp;
            }
          }
        }
        const { inverse } = await actions.ctx.repo.insert('attachments', {
          id,
          task_id: task.id,
          uploader_id: actions.ctx.userId,
          storage_path: path,
          file_name: file.name.slice(0, 255) || 'file',
          mime: file.type || 'application/octet-stream',
          size_bytes: file.size,
          width: size?.width ?? null,
          height: size?.height ?? null,
          thumb_path: thumbPath,
          deleted_at: null,
        } as never);
        actions.record(tc('toast.changed'), inverse);
      } catch {
        toast.error(t('failed', { name: file.name }));
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
  };

  const remove = async (a: AttachmentRow) => {
    const { inverse } = await actions.ctx.repo.update('attachments', a.id, { deleted_at: new Date().toISOString() });
    actions.record(tc('toast.changed'), inverse, t('removed'));
    // After the undo window the file itself is freed (it counts against the quota).
    setTimeout(async () => {
      const row = await actions.ctx.repo.get('attachments', a.id);
      if (!row?.deleted_at) return;
      const paths = [a.storage_path, a.thumb_path].filter((p): p is string => Boolean(p));
      const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
      if (!error) await actions.ctx.repo.remove('attachments', a.id);
    }, 9000);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  return (
    <section
      aria-labelledby={`att-${task.id}`}
      onDragOver={(e) => {
        if (readOnly || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn('relative rounded-md transition-colors', dragging && 'bg-surface-2 outline outline-1 outline-offset-4 outline-blue')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id={`att-${task.id}`} className="label-mono">
          {t('title')}
          {attachments.length > 0 && <span className="ml-2 font-mono tabular">{attachments.length}</span>}
        </h3>
        {!readOnly && (
          <>
            <Button size="sm" variant="ghost" icon={<Paperclip />} onClick={() => input.current?.click()}>
              {t('add')}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((a, i) => (
            <div key={a.id} className="group/att relative">
              <Thumb attachment={a} onOpen={() => setGallery(i)} />
              {!readOnly && (
                <button
                  type="button"
                  aria-label={t('remove', { name: a.file_name })}
                  onClick={() => void remove(a)}
                  className="focus-ring absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-sm bg-surface-1 text-fg opacity-0 transition-opacity group-hover/att:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className={cn('flex flex-col gap-1', images.length > 0 && 'mt-2')}>
          {files.map((a) => (
            <li key={a.id} className="group/file flex items-center gap-2.5 rounded-sm border border-line-strong bg-surface-2 px-2.5 py-1.5">
              <FileText aria-hidden className="size-4 shrink-0 text-fg-3" />
              <button
                type="button"
                onClick={async () => {
                  const url = await signedUrl(a.storage_path);
                  if (url) window.open(url, '_blank', 'noopener');
                }}
                aria-label={t('open', { name: a.file_name })}
                className="focus-ring min-w-0 flex-1 truncate rounded-xs text-left text-sm text-fg hover-ok:text-blue"
              >
                {a.file_name}
              </button>
              <span className="shrink-0 font-mono text-xs text-fg-3">{formatSize(Number(a.size_bytes), locale)}</span>
              {!readOnly && (
                <IconButton
                  size="sm"
                  variant="danger"
                  label={t('remove', { name: a.file_name })}
                  icon={<Trash2 />}
                  className="pointer-fine:opacity-0 pointer-fine:group-hover/file:opacity-100"
                  onClick={() => void remove(a)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {uploading.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1" aria-live="polite">
          {uploading.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-fg-2">
              <Spinner className="size-4" />
              {t('uploading', { name })}
            </li>
          ))}
        </ul>
      )}

      {attachments.length === 0 && uploading.length === 0 && !readOnly && (
        <p className="rounded-sm border border-dashed border-line-strong px-3 py-3 text-sm text-fg-3">{dragging ? t('drop') : t('empty')}</p>
      )}

      {gallery !== null && images.length > 0 && (
        <Gallery images={images} index={Math.min(gallery, images.length - 1)} onIndex={setGallery} onClose={() => setGallery(null)} />
      )}
    </section>
  );
}
