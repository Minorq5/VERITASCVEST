import Dexie, { type Table } from 'dexie';
import type { AnyRow, Entity, Mutation } from './types';

export interface ShadowRecord {
  entity: Entity;
  id: string;
  /** The last row the server confirmed. */
  row: AnyRow;
}

export interface TombstoneRecord {
  entity: Entity;
  id: string;
  tx: string;
  at: number;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

/**
 * The device's copy of one person's data (IndexedDB). What the interface
 * shows lives in the entity tables: the server's rows ("shadows") with this
 * device's unsent changes (the outbox) applied on top.
 */
export class VeritasDB extends Dexie {
  statuses!: Table<AnyRow, string>;
  priorities!: Table<AnyRow, string>;
  projects!: Table<AnyRow, string>;
  tags!: Table<AnyRow, string>;
  templates!: Table<AnyRow, string>;
  tasks!: Table<AnyRow, string>;
  task_tags!: Table<AnyRow, string>;
  task_milestones!: Table<AnyRow, string>;
  progress_events!: Table<AnyRow, string>;
  habit_logs!: Table<AnyRow, string>;
  time_sessions!: Table<AnyRow, string>;
  task_completions!: Table<AnyRow, string>;
  attachments!: Table<AnyRow, string>;
  comments!: Table<AnyRow, string>;
  shadows!: Table<ShadowRecord, [string, string]>;
  outbox!: Table<Mutation, number>;
  tombstones!: Table<TombstoneRecord, [string, string]>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      statuses: 'id',
      priorities: 'id',
      projects: 'id, parent_id',
      tags: 'id, name',
      templates: 'id',
      tasks: 'id, project_id, parent_id, due_date',
      task_tags: 'id, task_id, tag_id',
      task_milestones: 'id, task_id',
      progress_events: 'id, task_id',
      habit_logs: 'id, task_id',
      time_sessions: 'id, task_id',
      task_completions: 'id, task_id',
      attachments: 'id, task_id',
      comments: 'id, task_id',
      shadows: '[entity+id]',
      outbox: '++seq, [entity+row_id], id',
      tombstones: '[entity+id]',
      meta: 'key',
    });
  }

  table_(entity: Entity): Table<AnyRow, string> {
    return this.table(entity) as Table<AnyRow, string>;
  }
}

export function dbName(userId: string) {
  return `veritas-${userId}`;
}
