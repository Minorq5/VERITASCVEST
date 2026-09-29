'use client';

import { useQuery } from '@tanstack/react-query';
import { GitMerge, History, MessageSquare, RotateCcw, SendHorizontal, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfile } from '@/features/account/queries';
import type { TaskRow } from '@/lib/db/types';
import { newId } from '@/lib/ids';
import { avatarUrl, getSupabase } from '@/lib/supabase/client';
import { todayIn, type IsoDate } from '@/lib/time/dates';
import { useClientValue } from '@/lib/hooks/use-client-value';
import { toast } from '@/stores/toasts';
import type { PlannerPrefs, TaskParts } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import { formatClock, relativeDay } from '../format';

interface Props {
  task: TaskRow;
  parts: TaskParts;
  prefs: PlannerPrefs;
  today: IsoDate;
  actions: TaskActions;
  readOnly: boolean;
}

function When({ at, prefs, today }: { at: string; prefs: PlannerPrefs; today: IsoDate }) {
  const t = useTranslations('tasks');
  const date = new Date(at);
  return (
    <time dateTime={at} className="font-mono text-[0.6875rem] tracking-[0.04em] text-fg-3 uppercase">
      {relativeDay(todayIn(prefs.timeZone, date), today, prefs.locale, t)}, {formatClock(date, prefs.locale, prefs.hour12, prefs.timeZone)}
    </time>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
function Comments({ task, parts, prefs, today, actions, readOnly }: Props) {
  const t = useTranslations('tasks.comments');
  const tc = useTranslations('tasks');
  const profile = useProfile().data;
  const [body, setBody] = useState('');

  const send = async () => {
    const clean = body.trim();
    if (!clean) return;
    setBody('');
    const { inverse } = await actions.ctx.repo.insert('comments', {
      id: newId(),
      task_id: task.id,
      author_id: actions.ctx.userId,
      body: clean.slice(0, 5000),
      deleted_at: null,
    } as never);
    actions.record(tc('toast.changed'), inverse);
  };

  return (
    <div className="flex flex-col gap-3">
      {parts.comments.length === 0 ? (
        <p className="text-sm text-fg-3">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {parts.comments.map((c) => {
            const mine = c.author_id === actions.ctx.userId;
            return (
              <li key={c.id} className="group/comment flex gap-3">
                <Avatar name={mine ? (profile?.display_name ?? t('you')) : '?'} src={mine ? avatarUrl(profile?.avatar_path ?? null) : null} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg">{mine ? t('you') : '—'}</span>
                    <When at={c.created_at} prefs={prefs} today={today} />
                    {mine && !readOnly && (
                      <IconButton
                        size="sm"
                        variant="danger"
                        label={t('remove')}
                        icon={<Trash2 />}
                        className="ml-auto pointer-fine:opacity-0 pointer-fine:group-hover/comment:opacity-100"
                        onClick={async () => {
                          const { inverse } = await actions.ctx.repo.update('comments', c.id, { deleted_at: new Date().toISOString() });
                          actions.record(tc('toast.changed'), inverse, t('removed'));
                        }}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 text-base break-words whitespace-pre-wrap text-fg-2">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!readOnly && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={body}
            rows={Math.min(6, Math.max(1, body.split('\n').length))}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            aria-describedby={`comment-hint-${task.id}`}
            className="focus-ring min-h-10 min-w-0 flex-1 resize-none rounded-sm border border-line-strong bg-surface-1 px-3 py-2 text-base text-fg placeholder:text-fg-4 focus-visible:border-blue"
          />
          <IconButton type="submit" variant="primary" label={t('send')} icon={<SendHorizontal />} disabled={!body.trim()} />
        </form>
      )}
      {!readOnly && (
        <p id={`comment-hint-${task.id}`} className="text-xs text-fg-3 max-sm:hidden">
          {t('hint')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History (from the server: who changed what and when)
// ---------------------------------------------------------------------------
interface ActivityRow {
  id: number;
  actor_id: string | null;
  entity_type: string;
  action: 'created' | 'updated' | 'completed' | 'reopened' | 'deleted' | 'restored' | 'conflict';
  diff: Record<string, unknown>;
  created_at: string;
}

interface ConflictField {
  field: string;
  kept: unknown;
  lost: unknown;
  winner: 'mine' | 'server';
}

function HistoryTab({ task, prefs, today, actions }: Props) {
  const t = useTranslations('tasks.history');
  const tc = useTranslations('common');
  const online = useClientValue(() => navigator.onLine, true);
  const query = useQuery({
    queryKey: ['activity', task.id, task.version],
    enabled: online,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('activity_log')
        .select('id, actor_id, entity_type, action, diff, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ActivityRow[];
    },
  });

  const fieldName = (f: string) => {
    const key = `fields.${f}` as 'fields.title';
    return t.has(key) ? t(key) : f;
  };
  const show = (v: unknown) => {
    if (v === null || v === undefined || v === '') return t('empty_value');
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
    return String(v).slice(0, 120);
  };

  if (!online) return <p className="text-sm text-fg-3">{t('offline')}</p>;
  if (query.isPending) return <Skeleton className="h-24" />;
  if (query.isError)
    return (
      <div className="flex items-center gap-3 text-sm text-fg-3">
        {t('error')}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          {tc('retry')}
        </Button>
      </div>
    );
  if (!query.data.length) return <p className="text-sm text-fg-3">{t('empty')}</p>;

  return (
    <ol className="relative flex flex-col gap-3 pl-5 before:absolute before:top-1 before:bottom-1 before:left-[5px] before:w-px before:bg-line-strong">
      {query.data.map((row) => {
        const fields = row.action === 'conflict' ? ((row.diff.fields as ConflictField[] | undefined) ?? []) : [];
        const changed = row.action === 'updated' || row.action === 'deleted' || row.action === 'restored' ? Object.keys(row.diff).filter((k) => k !== 'deleted_at') : [];
        const text =
          row.action === 'updated'
            ? t('updated', { fields: changed.map(fieldName).join(', ') })
            : row.action === 'conflict'
              ? t('conflict', { field: fields.map((f) => fieldName(f.field)).join(', ') })
              : t(row.action);
        return (
          <li key={row.id} className="relative">
            <span
              aria-hidden
              className="absolute top-1.5 -left-5 size-[11px] rounded-full border-2 border-surface-1"
              style={{ background: row.action === 'conflict' ? 'var(--color-warning)' : row.action === 'completed' ? 'var(--color-success)' : 'var(--color-fg-4)' }}
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-fg">{row.actor_id === actions.ctx.userId ? t('you') : '—'}</span>
              <span className="text-sm text-fg-2">{text}</span>
              <When at={row.created_at} prefs={prefs} today={today} />
            </div>
            {row.action === 'updated' && changed.length > 0 && changed.length <= 3 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {changed.map((f) => {
                  const [before, after] = (row.diff[f] as [unknown, unknown] | undefined) ?? [null, null];
                  if (f === 'description_text' || f === 'recurrence' || f.endsWith('_id')) return null;
                  return (
                    <li key={f} className="text-xs text-fg-3">
                      <span className="line-through">{show(before)}</span> → <span className="text-fg-2">{show(after)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {fields.map((f) => (
              <div key={f.field} className="mt-1.5 rounded-sm border border-warning/40 bg-warning/8 px-2.5 py-2 text-xs">
                <p className="flex items-center gap-1.5 text-fg-2">
                  <GitMerge aria-hidden className="size-3.5 text-warning" />
                  {t('conflictKept', { value: show(f.kept) })}
                </p>
                <p className="mt-0.5 text-fg-3">{t('conflictLost', { value: show(f.lost) })}</p>
                {row.entity_type === 'tasks' && f.lost !== undefined && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2"
                    icon={<RotateCcw />}
                    onClick={async () => {
                      await actions.update(task.id, { [f.field]: f.lost } as Partial<TaskRow>);
                      toast.success(t('restoredValue'));
                    }}
                  >
                    {t('restoreValue')}
                  </Button>
                )}
              </div>
            ))}
          </li>
        );
      })}
    </ol>
  );
}

/** Comments and history under the task. */
export function DetailTabs(props: Props) {
  const t = useTranslations('tasks.detail.tabs');
  const [tab, setTab] = useState('comments');
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="comments">
          <MessageSquare aria-hidden />
          {t('comments')}
          {props.parts.comments.length > 0 && <span className="ml-1 font-mono text-xs text-fg-3">{props.parts.comments.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="history">
          <History aria-hidden />
          {t('history')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="comments" className="pt-4">
        <Comments {...props} />
      </TabsContent>
      <TabsContent value="history" className="pt-4">
        {tab === 'history' && <HistoryTab {...props} />}
      </TabsContent>
    </Tabs>
  );
}
