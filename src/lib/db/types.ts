import type { Database } from '@/lib/supabase/database.types';

type Tables = Database['public']['Tables'];

/** Synced tables, in the order a first download fills them. */
export const entities = [
  'statuses',
  'priorities',
  'projects',
  'tags',
  'templates',
  'tasks',
  'task_tags',
  'task_milestones',
  'progress_events',
  'habit_logs',
  'time_sessions',
  'task_completions',
  'attachments',
  'comments',
] as const;
export type Entity = (typeof entities)[number];

export function isEntity(value: unknown): value is Entity {
  return typeof value === 'string' && (entities as readonly string[]).includes(value);
}

/** Parts of a task: removed locally together with the task. */
export const taskParts = [
  'task_tags',
  'task_milestones',
  'progress_events',
  'habit_logs',
  'time_sessions',
  'task_completions',
  'attachments',
  'comments',
] as const satisfies readonly Entity[];

/** A row as the device keeps it: the server row without the merge clock; tx_id as text. */
export type LocalRow<E extends Entity> = Omit<Tables[E]['Row'], 'field_ts' | 'tx_id'> & { tx_id: string | null };

export type ProjectRow = LocalRow<'projects'>;
export type StatusRow = LocalRow<'statuses'>;
export type PriorityRow = LocalRow<'priorities'>;
export type TagRow = LocalRow<'tags'>;
export type TemplateRow = LocalRow<'templates'>;
export type TaskRow = LocalRow<'tasks'>;
export type TaskTagRow = LocalRow<'task_tags'>;
export type MilestoneRow = LocalRow<'task_milestones'>;
export type ProgressEventRow = LocalRow<'progress_events'>;
export type HabitLogRow = LocalRow<'habit_logs'>;
export type TimeSessionRow = LocalRow<'time_sessions'>;
export type CompletionRow = LocalRow<'task_completions'>;
export type AttachmentRow = LocalRow<'attachments'>;
export type CommentRow = LocalRow<'comments'>;

export type AnyRow = { id: string; version?: number; tx_id?: string | null } & Record<string, unknown>;

export type Op = 'insert' | 'update' | 'delete';

/** One change waiting in the outbox (and on the wire). */
export interface Mutation {
  /** Auto-increment order in the outbox. */
  seq?: number;
  /** Idempotency key: the server applies it at most once. */
  id: string;
  entity: Entity;
  op: Op;
  row_id: string;
  data: Record<string, unknown>;
  /** Values the device saw before the change (per changed field), for the 3-way merge. */
  base?: Record<string, unknown>;
  /** Edit time on the device (ms). */
  ts: number;
  /** 1 once a push picked it up: later edits make a new mutation instead of merging into it. */
  sealed: 0 | 1;
}
