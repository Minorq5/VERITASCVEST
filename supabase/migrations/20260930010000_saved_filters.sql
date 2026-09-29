-- ============================================================================
-- Veritas Tasks · Smart lists (saved filters), stage 4
-- A smart list is a named query over tasks (JSON, see src/lib/domain/filters.ts)
-- with its sort and view, pinned to the sidebar. It syncs like everything else.
-- ============================================================================

create table public.saved_filters (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text,
  color text not null default 'ash',
  query jsonb not null default '{}'::jsonb,
  sort text not null default 'due',
  view text not null default 'list',
  pinned boolean not null default true,
  sort_key text collate "C" not null default 'a0',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint saved_filters_name check (char_length(btrim(name)) between 1 and 60),
  constraint saved_filters_icon check (icon is null or icon ~ '^[a-z][a-z0-9-]{1,39}$'),
  constraint saved_filters_color check (color ~ '^[a-z][a-z0-9-]{1,23}$'),
  constraint saved_filters_query check (jsonb_typeof(query) = 'object' and pg_column_size(query) <= 16384),
  constraint saved_filters_sort check (sort in ('manual', 'due', 'priority', 'created', 'title', 'progress')),
  constraint saved_filters_view check (view in ('list', 'kanban', 'calendar', 'timeline', 'galaxy'))
);
create index saved_filters_owner_tx on public.saved_filters (owner_id, tx_id);

create trigger saved_filters_guard before insert or update or delete on public.saved_filters
for each row execute function private.sync_guard();
create trigger saved_filters_stamp before insert or update on public.saved_filters
for each row execute function private.sync_stamp();
create trigger saved_filters_tombstone after delete on public.saved_filters
for each row execute function private.record_tombstone();

alter table public.saved_filters enable row level security;
revoke all on table public.saved_filters from anon, authenticated;
grant select on table public.saved_filters to authenticated;
grant insert (id, owner_id, name, icon, color, query, sort, view, pinned, sort_key, deleted_at, field_ts),
      update (name, icon, color, query, sort, view, pinned, sort_key, deleted_at, field_ts),
      delete on public.saved_filters to authenticated;

create policy "saved_filters: owner reads" on public.saved_filters for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "saved_filters: owner creates" on public.saved_filters for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "saved_filters: owner updates" on public.saved_filters for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "saved_filters: owner deletes" on public.saved_filters for delete to authenticated
  using (owner_id = (select auth.uid()));

-- The sync API learns the new entity (same rules as before, one more case).
create or replace function private.sync_spec(p_entity text, out ins text[], out upd text[])
language plpgsql
immutable
set search_path = ''
as $$
begin
  case p_entity
    when 'projects' then
      ins := array['id', 'owner_id', 'parent_id', 'name', 'description', 'color', 'icon', 'planet_seed', 'sort_key', 'archived_at', 'view_settings', 'deleted_at'];
      upd := array['parent_id', 'name', 'description', 'color', 'icon', 'sort_key', 'archived_at', 'view_settings', 'deleted_at'];
    when 'statuses' then
      ins := array['id', 'owner_id', 'name', 'color', 'category', 'sort_key', 'deleted_at'];
      upd := array['name', 'color', 'category', 'sort_key', 'deleted_at'];
    when 'priorities' then
      ins := array['id', 'owner_id', 'name', 'color', 'rank', 'deleted_at'];
      upd := array['name', 'color', 'rank', 'deleted_at'];
    when 'tags' then
      ins := array['id', 'owner_id', 'name', 'color', 'deleted_at'];
      upd := array['name', 'color', 'deleted_at'];
    when 'saved_filters' then
      ins := array['id', 'owner_id', 'name', 'icon', 'color', 'query', 'sort', 'view', 'pinned', 'sort_key', 'deleted_at'];
      upd := array['name', 'icon', 'color', 'query', 'sort', 'view', 'pinned', 'sort_key', 'deleted_at'];
    when 'tasks' then
      ins := array['id', 'owner_id', 'project_id', 'parent_id', 'type', 'title', 'description', 'description_text',
                   'status_id', 'priority_id', 'color', 'icon', 'start_date', 'start_time', 'due_date', 'due_time',
                   'timezone', 'estimate_minutes', 'progress_current', 'progress_target', 'progress_unit',
                   'type_config', 'recurrence', 'reminders', 'completed_at', 'completed_by', 'sort_key', 'deleted_at', 'deleted_by'];
      upd := array['project_id', 'parent_id', 'type', 'title', 'description', 'description_text',
                   'status_id', 'priority_id', 'color', 'icon', 'start_date', 'start_time', 'due_date', 'due_time',
                   'timezone', 'estimate_minutes', 'progress_current', 'progress_target', 'progress_unit',
                   'type_config', 'recurrence', 'reminders', 'completed_at', 'completed_by', 'sort_key', 'deleted_at', 'deleted_by'];
    when 'task_tags' then
      ins := array['id', 'task_id', 'tag_id', 'owner_id', 'deleted_at'];
      upd := array['deleted_at'];
    when 'task_milestones' then
      ins := array['id', 'task_id', 'created_by', 'title', 'weight', 'done_at', 'due_date', 'sort_key', 'deleted_at'];
      upd := array['title', 'weight', 'done_at', 'due_date', 'sort_key', 'deleted_at'];
    when 'progress_events' then
      ins := array['id', 'task_id', 'user_id', 'kind', 'value', 'note', 'occurred_at', 'deleted_at'];
      upd := array['value', 'note', 'occurred_at', 'deleted_at'];
    when 'habit_logs' then
      ins := array['id', 'task_id', 'user_id', 'date', 'status', 'value', 'deleted_at'];
      upd := array['status', 'value', 'deleted_at'];
    when 'time_sessions' then
      ins := array['id', 'task_id', 'user_id', 'started_at', 'ended_at', 'seconds', 'kind', 'pomodoro_index', 'deleted_at'];
      upd := array['ended_at', 'seconds', 'kind', 'deleted_at'];
    when 'task_completions' then
      ins := array['id', 'task_id', 'user_id', 'occurrence_date', 'completed_at', 'on_time', 'priority_rank', 'project_id', 'task_type', 'deleted_at'];
      upd := array['deleted_at'];
    when 'attachments' then
      ins := array['id', 'task_id', 'uploader_id', 'storage_path', 'file_name', 'mime', 'size_bytes', 'width', 'height', 'thumb_path', 'deleted_at'];
      upd := array['file_name', 'deleted_at'];
    when 'comments' then
      ins := array['id', 'task_id', 'author_id', 'body', 'deleted_at'];
      upd := array['body', 'edited_at', 'deleted_at'];
    when 'templates' then
      ins := array['id', 'owner_id', 'kind', 'name', 'icon', 'payload', 'deleted_at'];
      upd := array['name', 'icon', 'payload', 'deleted_at'];
    else
      ins := null;
      upd := null;
  end case;
end;
$$;

create or replace function private.sync_entities()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'statuses', 'priorities', 'projects', 'tags', 'templates', 'saved_filters', 'tasks', 'task_tags', 'task_milestones',
    'progress_events', 'habit_logs', 'time_sessions', 'task_completions', 'attachments', 'comments'
  ];
$$;

alter publication supabase_realtime add table public.saved_filters;
