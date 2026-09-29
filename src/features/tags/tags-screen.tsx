'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/features/tasks/data/hooks';
import { TaskListView } from '@/features/tasks/list/list-view';
import { Link, useRouter } from '@/i18n/navigation';
import type { TagRow } from '@/lib/db/types';
import { TagDialog } from './tag-dialog';
import { TagMark, useTagCounts, type TagCounts } from './tag-mark';
import { TagMenu } from './tag-menu';

function TagItem({ tag, counts }: { tag: TagRow; counts: TagCounts | undefined }) {
  const t = useTranslations('tags');
  return (
    <li className="group/tag relative flex h-12 items-center gap-3 border-b border-line px-4 transition-colors last:border-b-0 hover-ok:bg-surface-2">
      <TagMark color={tag.color} />
      <Link
        href={`/tags/${tag.id}`}
        className="focus-ring min-w-0 flex-1 truncate rounded-xs text-base text-fg after:absolute after:inset-0 after:content-['']"
      >
        {tag.name}
      </Link>
      <span className="font-mono text-xs text-fg-3 tabular">{t('open', { count: counts?.open ?? 0 })}</span>
      <div className="relative z-[1]">
        <TagMenu tag={tag} tasks={counts?.all ?? 0} />
      </div>
    </li>
  );
}

/** All tags: how many tasks each has, rename, recolour, delete. */
export function TagsScreen() {
  const t = useTranslations('tags');
  const catalog = useCatalog();
  const counts = useTagCounts();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line pb-4">
        <div>
          {catalog && <p className="label-mono mb-2">{t('count', { count: catalog.tags.length })}</p>}
          <h1 className="font-display text-3xl font-medium text-fg">{t('title')}</h1>
        </div>
        <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setCreating(true)}>
          {t('new')}
        </Button>
      </header>

      {!catalog || !counts ? (
        <Skeleton className="h-48 rounded-md" />
      ) : catalog.tags.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.text')}
          action={
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              {t('new')}
            </Button>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-md border border-line bg-surface-1">
          {catalog.tags.map((tag) => (
            <TagItem key={tag.id} tag={tag} counts={counts.get(tag.id)} />
          ))}
        </ul>
      )}
      {creating && <TagDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

/** One tag's tasks, across every project. */
export function TagScreen({ id }: { id: string }) {
  const t = useTranslations('tags');
  const te = useTranslations('tasks.empty.tagMissing');
  const catalog = useCatalog();
  const counts = useTagCounts();
  const router = useRouter();

  if (!catalog) return null;
  const tag = catalog.tagById.get(id);
  if (!tag || tag.deleted_at) return <EmptyState title={te('title')} description={te('text')} />;
  const c = counts?.get(id);

  return (
    <TaskListView
      scope={{ kind: 'tag', tagId: id }}
      title={tag.name}
      chrome={{
        lead: <TagMark color={tag.color} size="lg" />,
        eyebrow: (
          <p className="label-mono mb-2">
            <Link href="/tags" className="focus-ring rounded-xs hover-ok:text-fg">
              {t('title')}
            </Link>
            <span aria-hidden> · </span>
            {t('open', { count: c?.open ?? 0 })}
          </p>
        ),
        actions: <TagMenu tag={tag} tasks={c?.all ?? 0} onDeleted={() => router.replace('/tags')} />,
      }}
    />
  );
}
