-- ============================================================================
-- Veritas Tasks · Tasks and synchronisation
--
-- Local-first model: every device keeps its own copy of the data and sends
-- changes as *mutations* through public.sync_push(). The server is the single
-- source of truth; devices converge by pulling changes (public.sync_pull()).
--
-- Guarantees (tested in supabase/tests and tests/integration):
-- * IDs are created on the device (UUID v7), so a repeated insert is never a
--   duplicate;
-- * every mutation carries its own id: the server applies it at most once and
--   answers a repeat with the same decision ("request sent, answer lost");
-- * updates are 3-way merged per field: base (what the device saw) → mine →
--   current. A field changed only by me is applied; a field changed by both is
--   decided by the later edit time (ties by mutation id). The losing value is
--   written to the task history and can be restored;
-- * pulls use transaction ids with a snapshot cursor, so no committed change
--   can be skipped, however transactions interleave;
-- * hard deletes leave tombstones, so other devices learn about them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sync infrastructure
-- ---------------------------------------------------------------------------

-- Decisions taken for each mutation id (per user): a repeat gets the same answer.
create table private.applied_mutations (
  user_id uuid not null,
  mutation_id uuid not null,
  status text not null check (status in ('applied', 'rejected')),
  error text,
  applied_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);

-- Hard deletes, so that devices can drop rows they still hold.
create table private.tombstones (
  entity text not null,
  row_id uuid not null,
  audience uuid[] not null,
  tx_id xid8 not null default pg_current_xact_id(),
  deleted_at timestamptz not null default now(),
  primary key (entity, row_id, tx_id)
);
create index tombstones_tx on private.tombstones (tx_id);
create index tombstones_audience on private.tombstones using gin (audience);

-- Oldest cursor that can still be served incrementally (tombstones before it
-- were cleaned up; an older device must download everything again).
create table private.sync_state (
  singleton boolean primary key default true check (singleton),
  horizon xid8 not null default '0'::xid8
);
insert into private.sync_state default values;

alter table private.applied_mutations enable row level security;
alter table private.tombstones enable row level security;
alter table private.sync_state enable row level security;
revoke all on table private.applied_mutations, private.tombstones, private.sync_state from anon, authenticated;

-- version, transaction id and timestamps are owned by the server.
create or replace function private.sync_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
  else
    new.version := old.version + 1;
    new.created_at := old.created_at;
  end if;
  new.tx_id := pg_current_xact_id();
  new.updated_at := now();
  return new;
end;
$$;

-- Signed-in users write synced tables only through sync_push(), which merges
-- concurrent edits correctly. Direct PostgREST writes would bypass the merge.
create or replace function private.sync_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and coalesce(current_setting('vt.via_sync', true), '') <> 'on' then
    raise exception using errcode = '42501', message = 'use_sync_push';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog: statuses, priorities, tags, projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.projects (id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null default 'cyan',
  icon text,
  planet_seed integer not null default floor(random() * 2147483647)::integer,
  sort_key text collate "C" not null default 'a0',
  archived_at timestamptz,
  view_settings jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint projects_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint projects_description_length check (char_length(description) <= 2000),
  constraint projects_color check (color ~ '^[a-z][a-z0-9-]{1,23}$'),
  constraint projects_icon check (icon is null or icon ~ '^[a-z][a-z0-9-]{1,39}$'),
  constraint projects_not_own_parent check (parent_id is distinct from id),
  constraint projects_view_settings check (jsonb_typeof(view_settings) = 'object')
);
create index projects_owner_tx on public.projects (owner_id, tx_id);
create index projects_parent on public.projects (parent_id);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  system_key text,
  name text,
  color text not null default 'slate',
  category text not null default 'todo',
  sort_key text collate "C" not null default 'a0',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint statuses_system_key check (system_key is null or system_key in ('todo', 'in_progress', 'paused', 'done', 'cancelled')),
  constraint statuses_named check (system_key is not null or char_length(btrim(coalesce(name, ''))) between 1 and 40),
  constraint statuses_name_length check (name is null or char_length(name) <= 40),
  constraint statuses_category check (category in ('todo', 'in_progress', 'done', 'cancelled')),
  constraint statuses_color check (color ~ '^[a-z][a-z0-9-]{1,23}$')
);
create unique index statuses_owner_system on public.statuses (owner_id, system_key) where system_key is not null;
create index statuses_owner_tx on public.statuses (owner_id, tx_id);

create table public.priorities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  system_key text,
  name text,
  color text not null default 'slate',
  rank smallint not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint priorities_system_key check (system_key is null or system_key in ('critical', 'high', 'medium', 'low')),
  constraint priorities_named check (system_key is not null or char_length(btrim(coalesce(name, ''))) between 1 and 40),
  constraint priorities_name_length check (name is null or char_length(name) <= 40),
  constraint priorities_rank check (rank between 1 and 9),
  constraint priorities_color check (color ~ '^[a-z][a-z0-9-]{1,23}$')
);
create unique index priorities_owner_system on public.priorities (owner_id, system_key) where system_key is not null;
create index priorities_owner_tx on public.priorities (owner_id, tx_id);

create table public.tags (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint tags_name check (char_length(btrim(name)) between 1 and 40 and name !~ '\s'),
  constraint tags_color check (color ~ '^[a-z][a-z0-9-]{1,23}$')
);
create index tags_owner_tx on public.tags (owner_id, tx_id);

-- Every new account gets the system statuses and priorities (names come from
-- the app's translations via system_key; people can add their own later).
create or replace function private.create_default_catalog(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.statuses (owner_id, system_key, color, category, sort_key)
  values
    (p_owner, 'todo', 'slate', 'todo', 'a0'),
    (p_owner, 'in_progress', 'sky', 'in_progress', 'a1'),
    (p_owner, 'paused', 'amber', 'in_progress', 'a2'),
    (p_owner, 'done', 'mint', 'done', 'a3'),
    (p_owner, 'cancelled', 'rose', 'cancelled', 'a4')
  on conflict do nothing;
  insert into public.priorities (owner_id, system_key, color, rank)
  values
    (p_owner, 'critical', 'critical', 1),
    (p_owner, 'high', 'high', 2),
    (p_owner, 'medium', 'medium', 3),
    (p_owner, 'low', 'low', 4)
  on conflict do nothing;
end;
$$;

create or replace function private.on_profile_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_default_catalog(new.id);
  return new;
end;
$$;

create trigger profiles_default_catalog after insert on public.profiles
for each row execute function private.on_profile_created();

select private.create_default_catalog(p.id) from public.profiles p;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  parent_id uuid references public.tasks (id) on delete cascade,
  quest_id uuid,
  type text not null default 'normal',
  title text not null,
  description jsonb,
  description_text text not null default '',
  status_id uuid references public.statuses (id) on delete set null,
  priority_id uuid references public.priorities (id) on delete set null,
  color text,
  icon text,
  start_date date,
  start_time time,
  due_date date,
  due_time time,
  timezone text not null default 'UTC',
  start_at timestamptz,
  due_at timestamptz,
  estimate_minutes integer,
  progress_current numeric not null default 0,
  progress_target numeric,
  progress_unit text,
  type_config jsonb not null default '{}'::jsonb,
  recurrence jsonb,
  completed_at timestamptz,
  completed_by uuid,
  sort_key text collate "C" not null default 'a0',
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint tasks_type check (type in (
    'normal', 'percent', 'numeric', 'subtasks', 'time', 'habit',
    'counter', 'stages', 'collab', 'abstain', 'chain'
  )),
  constraint tasks_title_length check (char_length(btrim(title)) between 1 and 500),
  constraint tasks_description_doc check (description is null or jsonb_typeof(description) = 'object'),
  constraint tasks_description_text_length check (char_length(description_text) <= 20000),
  constraint tasks_color check (color is null or color ~ '^[a-z][a-z0-9-]{1,23}$'),
  constraint tasks_icon check (icon is null or icon ~ '^[a-z][a-z0-9-]{1,39}$'),
  constraint tasks_timezone_length check (char_length(timezone) between 1 and 64),
  constraint tasks_estimate check (estimate_minutes is null or estimate_minutes between 0 and 100000),
  constraint tasks_progress check (progress_current between -1e12 and 1e12),
  constraint tasks_target check (progress_target is null or progress_target between 0 and 1e12),
  constraint tasks_unit_length check (progress_unit is null or char_length(progress_unit) <= 24),
  constraint tasks_type_config check (jsonb_typeof(type_config) = 'object'),
  constraint tasks_recurrence check (recurrence is null or jsonb_typeof(recurrence) = 'object'),
  constraint tasks_not_own_parent check (parent_id is distinct from id)
);
create index tasks_owner_tx on public.tasks (owner_id, tx_id);
create index tasks_parent on public.tasks (parent_id);
create index tasks_project on public.tasks (project_id);
create index tasks_status on public.tasks (status_id);
create index tasks_priority on public.tasks (priority_id);
create index tasks_due on public.tasks (owner_id, due_at) where deleted_at is null and completed_at is null;
create index tasks_trash on public.tasks (owner_id, deleted_at) where deleted_at is not null;

comment on table public.tasks is 'Tasks of every type. Written through sync_push(); readable by the owner (later: project members, assignees, quest members).';

-- Access helpers used by RLS. Stage 3: the owner; later stages widen these
-- (project members, assignees, quest members) without touching the policies.
create or replace function private.can_view_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tasks t where t.id = p_task and t.owner_id = (select auth.uid()));
$$;

create or replace function private.can_edit_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tasks t where t.id = p_task and t.owner_id = (select auth.uid()));
$$;

create or replace function private.task_owner(p_task uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.owner_id from public.tasks t where t.id = p_task;
$$;

-- Dates → absolute moments in the task's time zone; references must be visible.
create or replace function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cursor uuid;
  v_depth integer := 0;
begin
  begin
    perform now() at time zone new.timezone;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end;

  -- Normalise instead of rejecting: merged edits from two devices may combine
  -- a cleared date with a time set elsewhere, and must not lose the whole change.
  if new.due_date is null then
    new.due_time := null;
  end if;
  if new.start_date is null then
    new.start_time := null;
  end if;
  -- Who completed / deleted is recorded by the server, not claimed by the device.
  if new.completed_at is null then
    new.completed_by := null;
  elsif tg_op = 'INSERT' or old.completed_at is null then
    new.completed_by := coalesce(auth.uid(), new.completed_by);
  else
    new.completed_by := old.completed_by;
  end if;
  if new.deleted_at is null then
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  else
    new.deleted_by := old.deleted_by;
  end if;

  new.start_at := case when new.start_date is null then null
    else (new.start_date + coalesce(new.start_time, time '00:00')) at time zone new.timezone end;
  new.due_at := case when new.due_date is null then null
    else (new.due_date + coalesce(new.due_time, time '23:59:59')) at time zone new.timezone end;

  -- Foreign keys ignore RLS: make sure people only point at things they can see.
  if current_user in ('authenticated', 'anon') then
    if new.project_id is not null
       and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id)
       and not exists (select 1 from public.projects p where p.id = new.project_id) then
      raise exception using errcode = '23503', message = 'project_not_found';
    end if;
    if new.status_id is not null
       and (tg_op = 'INSERT' or new.status_id is distinct from old.status_id)
       and not exists (select 1 from public.statuses s where s.id = new.status_id) then
      raise exception using errcode = '23503', message = 'status_not_found';
    end if;
    if new.priority_id is not null
       and (tg_op = 'INSERT' or new.priority_id is distinct from old.priority_id)
       and not exists (select 1 from public.priorities p where p.id = new.priority_id) then
      raise exception using errcode = '23503', message = 'priority_not_found';
    end if;
  end if;

  -- Subtasks: the parent must be visible and never one of the task's descendants.
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    if current_user in ('authenticated', 'anon') and not private.can_view_task(new.parent_id) then
      raise exception using errcode = '23503', message = 'parent_not_found';
    end if;
    v_cursor := new.parent_id;
    while v_cursor is not null loop
      if v_cursor = new.id then
        raise exception using errcode = '23514', message = 'task_cycle';
      end if;
      v_depth := v_depth + 1;
      if v_depth > 64 then
        raise exception using errcode = '23514', message = 'task_too_deep';
      end if;
      select t.parent_id into v_cursor from public.tasks t where t.id = v_cursor;
    end loop;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Task parts: tags, milestones, progress events, habits, time, completions,
-- attachments, comments; own templates.
-- ---------------------------------------------------------------------------
create table public.task_tags (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb
);
create index task_tags_task on public.task_tags (task_id);
create index task_tags_tag on public.task_tags (tag_id);
create index task_tags_owner_tx on public.task_tags (owner_id, tx_id);

-- Stages ("Этапная") and steps ("Цепочка").
create table public.task_milestones (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  weight numeric not null default 0,
  done_at timestamptz,
  due_date date,
  sort_key text collate "C" not null default 'a0',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint task_milestones_title check (char_length(btrim(title)) between 1 and 300),
  constraint task_milestones_weight check (weight between 0 and 100)
);
create index task_milestones_task on public.task_milestones (task_id);
create index task_milestones_tx on public.task_milestones (tx_id);

-- Progress as events: "+1", "+25 pages", a contribution, a relapse. Two
-- offline devices that both add +1 end up with +2, never a lost value.
create table public.progress_events (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  value numeric not null default 0,
  note text,
  occurred_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint progress_events_kind check (kind in ('set', 'delta', 'contribution', 'relapse', 'reset')),
  constraint progress_events_value check (value between -1e12 and 1e12),
  constraint progress_events_note check (note is null or char_length(note) <= 500)
);
create index progress_events_task on public.progress_events (task_id, occurred_at);
create index progress_events_tx on public.progress_events (tx_id);

-- One row per habit, person and day (the id is derived from these on the device).
create table public.habit_logs (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null,
  value numeric,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint habit_logs_status check (status in ('done', 'skip', 'freeze', 'fail')),
  constraint habit_logs_value check (value is null or value between -1e9 and 1e9),
  constraint habit_logs_unique_day unique (task_id, user_id, date)
);
create index habit_logs_tx on public.habit_logs (tx_id);

create table public.time_sessions (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  seconds integer,
  kind text not null default 'focus',
  pomodoro_index smallint,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint time_sessions_kind check (kind in ('focus', 'break', 'manual')),
  constraint time_sessions_order check (ended_at is null or ended_at >= started_at),
  constraint time_sessions_seconds check (seconds is null or seconds between 0 and 86400 * 7)
);
create index time_sessions_task on public.time_sessions (task_id);
create index time_sessions_tx on public.time_sessions (tx_id);

-- Every completion (a recurring task has one per occurrence): the source of
-- statistics and, from stage 6, of XP.
create table public.task_completions (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurrence_date date,
  completed_at timestamptz not null default now(),
  on_time boolean,
  priority_rank smallint,
  project_id uuid,
  task_type text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb
);
create index task_completions_task on public.task_completions (task_id);
create index task_completions_user on public.task_completions (user_id, completed_at);
create index task_completions_tx on public.task_completions (tx_id);

create table public.attachments (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime text not null default 'application/octet-stream',
  size_bytes bigint not null,
  width integer,
  height integer,
  thumb_path text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint attachments_path check (storage_path like task_id::text || '/' || id::text || '/%'),
  constraint attachments_thumb check (thumb_path is null or thumb_path like task_id::text || '/' || id::text || '/%'),
  constraint attachments_name check (char_length(btrim(file_name)) between 1 and 255),
  constraint attachments_mime check (char_length(mime) between 3 and 255),
  constraint attachments_size check (size_bytes between 0 and 10485760)
);
create index attachments_task on public.attachments (task_id);
create index attachments_tx on public.attachments (tx_id);

create table public.comments (
  id uuid primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint comments_body check (char_length(btrim(body)) between 1 and 5000)
);
create index comments_task on public.comments (task_id, created_at);
create index comments_tx on public.comments (tx_id);

create table public.templates (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'task',
  name text not null,
  icon text,
  payload jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  tx_id xid8 not null default pg_current_xact_id(),
  field_ts jsonb not null default '{}'::jsonb,
  constraint templates_kind check (kind in ('task', 'project')),
  constraint templates_name check (char_length(btrim(name)) between 1 and 80),
  constraint templates_icon check (icon is null or icon ~ '^[a-z][a-z0-9-]{1,39}$'),
  constraint templates_payload check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 262144)
);
create index templates_owner_tx on public.templates (owner_id, tx_id);

-- Visible references for parts (FKs ignore RLS).
create or replace function private.task_part_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (tg_op = 'INSERT' or new.task_id is distinct from old.task_id)
     and not private.can_edit_task(new.task_id) then
    raise exception using errcode = '42501', message = 'task_not_editable';
  end if;
  return new;
end;
$$;

create or replace function private.task_tags_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (tg_op = 'INSERT' or new.tag_id is distinct from old.tag_id)
     and not exists (select 1 from public.tags g where g.id = new.tag_id) then
    raise exception using errcode = '23503', message = 'tag_not_found';
  end if;
  return new;
end;
$$;

-- A habit may be frozen at most once per ISO week.
create or replace function private.habit_logs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'freeze' and new.deleted_at is null and exists (
    select 1 from public.habit_logs h
    where h.task_id = new.task_id and h.user_id = new.user_id and h.id <> new.id
      and h.status = 'freeze' and h.deleted_at is null
      and date_trunc('week', h.date::timestamp) = date_trunc('week', new.date::timestamp)
  ) then
    raise exception using errcode = '23514', message = 'freeze_once_a_week';
  end if;
  return new;
end;
$$;

create or replace function private.projects_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cursor uuid;
  v_depth integer := 0;
begin
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    if current_user in ('authenticated', 'anon')
       and not exists (select 1 from public.projects p where p.id = new.parent_id) then
      raise exception using errcode = '23503', message = 'parent_not_found';
    end if;
    v_cursor := new.parent_id;
    while v_cursor is not null loop
      if v_cursor = new.id then
        raise exception using errcode = '23514', message = 'project_cycle';
      end if;
      v_depth := v_depth + 1;
      if v_depth > 32 then
        raise exception using errcode = '23514', message = 'project_too_deep';
      end if;
      select p.parent_id into v_cursor from public.projects p where p.id = v_cursor;
    end loop;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- History (activity log): written by triggers only.
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  task_id uuid references public.tasks (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  action text not null,
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_action check (action in (
    'created', 'updated', 'completed', 'reopened', 'deleted', 'restored', 'conflict'
  ))
);
create index activity_log_task on public.activity_log (task_id, created_at desc);
create index activity_log_owner on public.activity_log (owner_id, created_at desc);

create or replace function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields constant text[] := array[
    'title', 'description_text', 'type', 'status_id', 'priority_id', 'project_id', 'parent_id',
    'color', 'icon', 'start_date', 'start_time', 'due_date', 'due_time', 'timezone',
    'estimate_minutes', 'progress_current', 'progress_target', 'progress_unit', 'recurrence'
  ];
  v_old jsonb;
  v_new jsonb;
  v_diff jsonb := '{}'::jsonb;
  v_action text := 'updated';
  f text;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, owner_id, entity_type, entity_id, task_id, project_id, action, diff)
    values (auth.uid(), new.owner_id, 'task', new.id, new.id, new.project_id, 'created',
            jsonb_build_object('title', jsonb_build_array(null, new.title)));
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    v_action := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'restored';
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  foreach f in array v_fields loop
    if (v_old -> f) is distinct from (v_new -> f) then
      v_diff := v_diff || jsonb_build_object(f, jsonb_build_array(
        case when f = 'description_text' then to_jsonb(left(old.description_text, 280)) else v_old -> f end,
        case when f = 'description_text' then to_jsonb(left(new.description_text, 280)) else v_new -> f end
      ));
    end if;
  end loop;

  -- Pure bookkeeping (sorting, completion stamps) does not clutter the history.
  if v_action = 'updated' and v_diff = '{}'::jsonb then
    return new;
  end if;
  insert into public.activity_log (actor_id, owner_id, entity_type, entity_id, task_id, project_id, action, diff)
  values (auth.uid(), new.owner_id, 'task', new.id, new.id, new.project_id, v_action, v_diff);
  return new;
end;
$$;

create or replace function private.log_completion_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := private.task_owner(new.task_id);
begin
  if v_owner is null then
    return new;
  end if;
  if tg_op = 'INSERT' and new.deleted_at is null then
    insert into public.activity_log (actor_id, owner_id, entity_type, entity_id, task_id, action, diff)
    values (auth.uid(), v_owner, 'completion', new.id, new.task_id, 'completed',
            jsonb_build_object('occurrence_date', new.occurrence_date));
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    insert into public.activity_log (actor_id, owner_id, entity_type, entity_id, task_id, action, diff)
    values (auth.uid(), v_owner, 'completion', new.id, new.task_id, 'reopened',
            jsonb_build_object('occurrence_date', new.occurrence_date));
  end if;
  return new;
end;
$$;

create or replace function private.log_conflict(p_entity text, p_row uuid, p_conflicts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task uuid;
  v_owner uuid;
begin
  if p_entity = 'tasks' then
    v_task := p_row;
  elsif p_entity in ('task_milestones', 'progress_events', 'habit_logs', 'time_sessions', 'task_completions', 'attachments', 'comments', 'task_tags') then
    execute format('select task_id from public.%I where id = $1', p_entity) into v_task using p_row;
  end if;
  v_owner := coalesce(private.task_owner(v_task), auth.uid());
  insert into public.activity_log (actor_id, owner_id, entity_type, entity_id, task_id, action, diff)
  values (auth.uid(), v_owner, p_entity, p_row, v_task, 'conflict', jsonb_build_object('fields', p_conflicts));
end;
$$;

-- ---------------------------------------------------------------------------
-- Tombstones for hard deletes
-- ---------------------------------------------------------------------------
create or replace function private.record_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(old);
  v_audience uuid[];
begin
  v_audience := array_remove(array[
    private.try_uuid(v_row ->> 'owner_id'),
    private.try_uuid(v_row ->> 'user_id'),
    private.try_uuid(v_row ->> 'author_id'),
    private.try_uuid(v_row ->> 'uploader_id'),
    private.try_uuid(v_row ->> 'created_by'),
    case when v_row ? 'task_id' then private.task_owner(private.try_uuid(v_row ->> 'task_id')) end
  ], null);
  insert into private.tombstones (entity, row_id, audience)
  values (tg_table_name, old.id, v_audience)
  on conflict do nothing;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers on every synced table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'statuses', 'priorities', 'tags', 'tasks', 'task_tags', 'task_milestones',
    'progress_events', 'habit_logs', 'time_sessions', 'task_completions', 'attachments',
    'comments', 'templates'
  ] loop
    execute format('create trigger %1$s_guard before insert or update or delete on public.%1$I
      for each row execute function private.sync_guard()', t);
    execute format('create trigger %1$s_stamp before insert or update on public.%1$I
      for each row execute function private.sync_stamp()', t);
    execute format('create trigger %1$s_tombstone after delete on public.%1$I
      for each row execute function private.record_tombstone()', t);
  end loop;
end;
$$;

create trigger tasks_before_write before insert or update on public.tasks
for each row execute function private.tasks_before_write();
create trigger tasks_activity after insert or update on public.tasks
for each row execute function private.log_task_activity();
create trigger projects_before_write before insert or update on public.projects
for each row execute function private.projects_before_write();
create trigger task_tags_before_write before insert or update on public.task_tags
for each row execute function private.task_tags_before_write();
create trigger habit_logs_before_write before insert or update on public.habit_logs
for each row execute function private.habit_logs_before_write();
create trigger task_completions_activity after insert or update on public.task_completions
for each row execute function private.log_completion_activity();

do $$
declare
  t text;
begin
  foreach t in array array[
    'task_tags', 'task_milestones', 'progress_events', 'habit_logs', 'time_sessions',
    'task_completions', 'attachments', 'comments'
  ] loop
    execute format('create trigger %1$s_task_access before insert or update on public.%1$I
      for each row execute function private.task_part_before_write()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'statuses', 'priorities', 'tags', 'tasks', 'task_tags', 'task_milestones',
    'progress_events', 'habit_logs', 'time_sessions', 'task_completions', 'attachments',
    'comments', 'templates', 'activity_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end;
$$;

-- Owner-only catalogs.
do $$
declare
  t text;
begin
  foreach t in array array['projects', 'statuses', 'priorities', 'tags', 'templates'] loop
    execute format('create policy "%1$s: owner reads" on public.%1$I for select to authenticated
      using (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner creates" on public.%1$I for insert to authenticated
      with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner updates" on public.%1$I for update to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner deletes" on public.%1$I for delete to authenticated
      using (owner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

create policy "tasks: visible" on public.tasks for select to authenticated
using (owner_id = (select auth.uid()));
create policy "tasks: create own" on public.tasks for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy "tasks: edit" on public.tasks for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "tasks: purge" on public.tasks for delete to authenticated
using (owner_id = (select auth.uid()));

-- Parts follow their task; personal rows (events, sessions…) are written only as yourself.
do $$
declare
  spec text[];
  specs text[][] := array[
    array['task_tags', 'owner_id'],
    array['task_milestones', 'created_by'],
    array['progress_events', 'user_id'],
    array['habit_logs', 'user_id'],
    array['time_sessions', 'user_id'],
    array['task_completions', 'user_id'],
    array['attachments', 'uploader_id'],
    array['comments', 'author_id']
  ];
begin
  foreach spec slice 1 in array specs loop
    execute format('create policy "%1$s: task visible" on public.%1$I for select to authenticated
      using (private.can_view_task(task_id))', spec[1]);
    execute format('create policy "%1$s: add as yourself" on public.%1$I for insert to authenticated
      with check (%2$I = (select auth.uid()) and private.can_edit_task(task_id))', spec[1], spec[2]);
    execute format('create policy "%1$s: edit" on public.%1$I for update to authenticated
      using (private.can_edit_task(task_id)) with check (private.can_edit_task(task_id))', spec[1]);
    execute format('create policy "%1$s: delete" on public.%1$I for delete to authenticated
      using (private.can_edit_task(task_id))', spec[1]);
  end loop;
end;
$$;

create policy "activity: visible task or own" on public.activity_log for select to authenticated
using (owner_id = (select auth.uid()) or (task_id is not null and private.can_view_task(task_id)));

-- Column privileges: the client may write content columns and the merge clock;
-- ids of owners, versions, transaction ids and computed dates are server-owned.
grant insert (id, owner_id, parent_id, name, description, color, icon, planet_seed, sort_key, archived_at, view_settings, deleted_at, field_ts),
      update (parent_id, name, description, color, icon, sort_key, archived_at, view_settings, deleted_at, field_ts),
      delete on public.projects to authenticated;
grant insert (id, owner_id, system_key, name, color, category, sort_key, deleted_at, field_ts),
      update (name, color, category, sort_key, deleted_at, field_ts),
      delete on public.statuses to authenticated;
grant insert (id, owner_id, system_key, name, color, rank, deleted_at, field_ts),
      update (name, color, rank, deleted_at, field_ts),
      delete on public.priorities to authenticated;
grant insert (id, owner_id, name, color, deleted_at, field_ts),
      update (name, color, deleted_at, field_ts),
      delete on public.tags to authenticated;
grant insert (id, owner_id, project_id, parent_id, type, title, description, description_text, status_id, priority_id,
              color, icon, start_date, start_time, due_date, due_time, timezone, estimate_minutes, progress_current,
              progress_target, progress_unit, type_config, recurrence, completed_at, completed_by, sort_key,
              deleted_at, deleted_by, field_ts),
      update (project_id, parent_id, type, title, description, description_text, status_id, priority_id,
              color, icon, start_date, start_time, due_date, due_time, timezone, estimate_minutes, progress_current,
              progress_target, progress_unit, type_config, recurrence, completed_at, completed_by, sort_key,
              deleted_at, deleted_by, field_ts),
      delete on public.tasks to authenticated;
grant insert (id, task_id, tag_id, owner_id, deleted_at, field_ts),
      update (deleted_at, field_ts),
      delete on public.task_tags to authenticated;
grant insert (id, task_id, created_by, title, weight, done_at, due_date, sort_key, deleted_at, field_ts),
      update (title, weight, done_at, due_date, sort_key, deleted_at, field_ts),
      delete on public.task_milestones to authenticated;
grant insert (id, task_id, user_id, kind, value, note, occurred_at, deleted_at, field_ts),
      update (value, note, occurred_at, deleted_at, field_ts),
      delete on public.progress_events to authenticated;
grant insert (id, task_id, user_id, date, status, value, deleted_at, field_ts),
      update (status, value, deleted_at, field_ts),
      delete on public.habit_logs to authenticated;
grant insert (id, task_id, user_id, started_at, ended_at, seconds, kind, pomodoro_index, deleted_at, field_ts),
      update (ended_at, seconds, kind, deleted_at, field_ts),
      delete on public.time_sessions to authenticated;
grant insert (id, task_id, user_id, occurrence_date, completed_at, on_time, priority_rank, project_id, task_type, deleted_at, field_ts),
      update (deleted_at, field_ts),
      delete on public.task_completions to authenticated;
grant insert (id, task_id, uploader_id, storage_path, file_name, mime, size_bytes, width, height, thumb_path, deleted_at, field_ts),
      update (file_name, deleted_at, field_ts),
      delete on public.attachments to authenticated;
grant insert (id, task_id, author_id, body, deleted_at, field_ts),
      update (body, edited_at, deleted_at, field_ts),
      delete on public.comments to authenticated;
grant insert (id, owner_id, kind, name, icon, payload, deleted_at, field_ts),
      update (name, icon, payload, deleted_at, field_ts),
      delete on public.templates to authenticated;

-- ---------------------------------------------------------------------------
-- The sync API
-- ---------------------------------------------------------------------------

-- What a device may write for each entity (the table name doubles as the entity name).
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
    when 'tasks' then
      ins := array['id', 'owner_id', 'project_id', 'parent_id', 'type', 'title', 'description', 'description_text',
                   'status_id', 'priority_id', 'color', 'icon', 'start_date', 'start_time', 'due_date', 'due_time',
                   'timezone', 'estimate_minutes', 'progress_current', 'progress_target', 'progress_unit',
                   'type_config', 'recurrence', 'completed_at', 'completed_by', 'sort_key', 'deleted_at', 'deleted_by'];
      upd := array['project_id', 'parent_id', 'type', 'title', 'description', 'description_text',
                   'status_id', 'priority_id', 'color', 'icon', 'start_date', 'start_time', 'due_date', 'due_time',
                   'timezone', 'estimate_minutes', 'progress_current', 'progress_target', 'progress_unit',
                   'type_config', 'recurrence', 'completed_at', 'completed_by', 'sort_key', 'deleted_at', 'deleted_by'];
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
    'statuses', 'priorities', 'projects', 'tags', 'templates', 'tasks', 'task_tags', 'task_milestones',
    'progress_events', 'habit_logs', 'time_sessions', 'task_completions', 'attachments', 'comments'
  ];
$$;

create or replace function private.mutation_decision(p_user uuid, p_mutation uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('status', m.status, 'error', m.error)
  from private.applied_mutations m
  where m.user_id = p_user and m.mutation_id = p_mutation;
$$;

create or replace function private.remember_mutation(p_user uuid, p_mutation uuid, p_status text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.applied_mutations (user_id, mutation_id, status, error)
  values (p_user, p_mutation, p_status, p_error)
  on conflict (user_id, mutation_id) do nothing;
$$;

-- The row as the caller can see it (RLS applies), without the merge clock.
create or replace function private.sync_row(p_entity text, p_row uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not (p_entity = any (private.sync_entities())) then
    return null;
  end if;
  execute format('select to_jsonb(t) - ''field_ts'' from public.%I t where t.id = $1', p_entity)
  into v using p_row;
  return v;
end;
$$;

-- Is (ts, id) newer than the clock [ts, id] stored for a field?
create or replace function private.clock_newer(p_ts bigint, p_mutation uuid, p_clock jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_clock is null
      or jsonb_typeof(p_clock) <> 'array'
      or p_ts > (p_clock ->> 0)::bigint
      or (p_ts = (p_clock ->> 0)::bigint and p_mutation::text > coalesce(p_clock ->> 1, ''));
$$;

-- 3-way merge of a patch into the current row (see the header). With p_base
-- = null (an insert that met an existing row) every differing field is a
-- conflict decided by the clocks.
create or replace function private.sync_update(
  p_entity text,
  p_row uuid,
  p_data jsonb,
  p_base jsonb,
  p_ts bigint,
  p_mutation uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_spec record;
  v_cur jsonb;
  v_mine jsonb;
  v_base jsonb;
  v_clocks jsonb;
  v_apply text[] := '{}';
  v_conflicts jsonb := '[]'::jsonb;
  v_sets text;
  v_new jsonb;
  f text;
begin
  select * into v_spec from private.sync_spec(p_entity);

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', p_entity)
  into v_cur using p_row;
  if v_cur is null then
    raise exception using errcode = 'P0002', message = 'not_found';
  end if;

  -- Normalise both sides through the table's row type: casts validate values
  -- and give the same JSON shape as the stored row (dates, numbers, times).
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', p_entity) into v_mine using p_data;
  if p_base is not null then
    execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', p_entity) into v_base using p_base;
  end if;
  v_clocks := coalesce(v_cur -> 'field_ts', '{}'::jsonb);

  for f in select jsonb_object_keys(p_data) loop
    if not (f = any (v_spec.upd)) then
      if p_base is null then
        continue; -- insert collision: server-owned and identity fields are ignored
      end if;
      raise exception using errcode = '42501', message = 'field_not_writable:' || f;
    end if;

    if (v_cur -> f) is not distinct from (v_mine -> f) then
      continue;
    end if;

    if p_base is not null and p_base ? f and (v_base -> f) is not distinct from (v_cur -> f) then
      -- Nobody else touched this field since the device saw it.
      v_apply := v_apply || f;
      v_clocks := jsonb_set(v_clocks, array[f], jsonb_build_array(p_ts, p_mutation));
    elsif private.clock_newer(p_ts, p_mutation, v_clocks -> f) then
      v_apply := v_apply || f;
      v_clocks := jsonb_set(v_clocks, array[f], jsonb_build_array(p_ts, p_mutation));
      v_conflicts := v_conflicts || jsonb_build_object('field', f, 'kept', v_mine -> f, 'lost', v_cur -> f, 'winner', 'mine');
    else
      v_conflicts := v_conflicts || jsonb_build_object('field', f, 'kept', v_cur -> f, 'lost', v_mine -> f, 'winner', 'server');
    end if;
  end loop;

  if array_length(v_apply, 1) is null then
    v_new := v_cur - 'field_ts';
  else
    select string_agg(format('%1$I = r.%1$I', c), ', ') into v_sets from unnest(v_apply) as c;
    execute format(
      'update public.%1$I t set %2$s, field_ts = $2 from jsonb_populate_record(null::public.%1$I, $1) r
       where t.id = $3 returning to_jsonb(t) - ''field_ts''',
      p_entity, v_sets
    ) into v_new using p_data, v_clocks, p_row;
  end if;

  if jsonb_array_length(v_conflicts) > 0 then
    perform private.log_conflict(p_entity, p_row, v_conflicts);
  end if;

  return jsonb_build_object('row', v_new, 'conflicts', v_conflicts);
end;
$$;

create or replace function private.sync_insert(p_entity text, p_row uuid, p_data jsonb, p_ts bigint, p_mutation uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_spec record;
  v_data jsonb := p_data || jsonb_build_object('id', p_row);
  v_cols text[] := '{}';
  v_clocks jsonb := '{}'::jsonb;
  v_new jsonb;
  f text;
begin
  select * into v_spec from private.sync_spec(p_entity);
  for f in select jsonb_object_keys(v_data) loop
    if not (f = any (v_spec.ins)) then
      raise exception using errcode = '42501', message = 'field_not_writable:' || f;
    end if;
    v_cols := v_cols || f;
    if f <> 'id' then
      v_clocks := v_clocks || jsonb_build_object(f, jsonb_build_array(p_ts, p_mutation));
    end if;
  end loop;

  execute format(
    'insert into public.%1$I as t (%2$s, field_ts) select %3$s, $2 from jsonb_populate_record(null::public.%1$I, $1) r
     on conflict (id) do nothing returning to_jsonb(t) - ''field_ts''',
    p_entity,
    (select string_agg(format('%I', c), ', ') from unnest(v_cols) as c),
    (select string_agg(format('r.%I', c), ', ') from unnest(v_cols) as c)
  ) into v_new using v_data, v_clocks;

  if v_new is not null then
    return jsonb_build_object('row', v_new, 'conflicts', '[]'::jsonb);
  end if;
  -- The id exists already (the same row created on two devices, e.g. a tag
  -- added to a task on both): merge like concurrent edits.
  return private.sync_update(p_entity, p_row, p_data, null, p_ts, p_mutation);
end;
$$;

create or replace function private.sync_apply(p_user uuid, p_mutation jsonb, p_now_ms bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_entity text;
  v_op text;
  v_row uuid;
  v_data jsonb;
  v_base jsonb;
  v_ts bigint;
  v_prev jsonb;
  v_out jsonb;
  v_state text;
  v_msg text;
begin
  begin
    v_id := (p_mutation ->> 'id')::uuid;
    v_entity := p_mutation ->> 'entity';
    v_op := p_mutation ->> 'op';
    v_row := (p_mutation ->> 'row_id')::uuid;
    v_data := coalesce(p_mutation -> 'data', '{}'::jsonb);
    v_base := coalesce(p_mutation -> 'base', '{}'::jsonb);
    -- Edit time from the device; a clock far in the future cannot win forever.
    v_ts := least(coalesce((p_mutation ->> 'ts')::bigint, p_now_ms), p_now_ms + 60000);
    if v_id is null or v_row is null or jsonb_typeof(v_data) <> 'object' or jsonb_typeof(v_base) <> 'object' then
      raise exception 'malformed';
    end if;
  exception when others then
    return jsonb_build_object('id', p_mutation ->> 'id', 'status', 'rejected', 'error', 'malformed');
  end;

  v_prev := private.mutation_decision(p_user, v_id);
  if v_prev is not null then
    return jsonb_build_object(
      'id', v_id, 'status', 'duplicate', 'decision', v_prev ->> 'status', 'error', v_prev ->> 'error',
      'row', private.sync_row(v_entity, v_row)
    );
  end if;

  if not (v_entity = any (private.sync_entities())) then
    perform private.remember_mutation(p_user, v_id, 'rejected', 'unknown_entity');
    return jsonb_build_object('id', v_id, 'status', 'rejected', 'error', 'unknown_entity');
  end if;

  begin
    case v_op
      when 'insert' then
        v_out := private.sync_insert(v_entity, v_row, v_data, v_ts, v_id);
      when 'update' then
        v_out := private.sync_update(v_entity, v_row, v_data, v_base, v_ts, v_id);
      when 'delete' then
        execute format('delete from public.%I where id = $1', v_entity) using v_row;
        v_out := jsonb_build_object('row', null, 'conflicts', '[]'::jsonb);
      else
        raise exception using errcode = '22023', message = 'unknown_op';
    end case;
  exception
    when serialization_failure or deadlock_detected or lock_not_available or query_canceled then
      raise; -- transient: the whole batch fails and the device retries later
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      perform private.remember_mutation(p_user, v_id, 'rejected', v_state || ':' || left(v_msg, 200));
      return jsonb_build_object(
        'id', v_id, 'status', 'rejected', 'error', v_state || ':' || left(v_msg, 200),
        'row', private.sync_row(v_entity, v_row)
      );
  end;

  perform private.remember_mutation(p_user, v_id, 'applied', null);
  return v_out || jsonb_build_object('id', v_id, 'status', 'applied');
end;
$$;

create or replace function public.sync_push(p_mutations jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_results jsonb := '[]'::jsonb;
  m jsonb;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if jsonb_typeof(p_mutations) <> 'array' or jsonb_array_length(p_mutations) > 200 then
    raise exception using errcode = '22023', message = 'invalid_batch';
  end if;
  perform private.enforce_rate_limit('sync_push:' || v_user, 300, interval '1 minute');
  perform set_config('vt.via_sync', 'on', true);
  for m in select value from jsonb_array_elements(p_mutations) loop
    v_results := v_results || jsonb_build_array(private.sync_apply(v_user, m, v_now_ms));
  end loop;
  perform set_config('vt.via_sync', '', true);
  return jsonb_build_object('results', v_results, 'server_time', v_now_ms);
end;
$$;

comment on function public.sync_push(jsonb) is
  'Applies device mutations [{id, entity, op: insert|update|delete, row_id, data, base, ts}] in order. Idempotent per mutation id; per-field 3-way merge.';

create or replace function private.sync_tombstones(p_user uuid, p_from xid8)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('entity', t.entity, 'id', t.row_id, 'tx_id', t.tx_id::text) order by t.tx_id), '[]'::jsonb)
  from private.tombstones t
  where t.tx_id >= p_from and p_user = any (t.audience);
$$;

create or replace function private.sync_horizon()
returns xid8
language sql
stable
security definer
set search_path = ''
as $$
  select horizon from private.sync_state;
$$;

-- Changes since a cursor. The new cursor is the oldest transaction still in
-- flight when the pull started: rows of any transaction that commits later
-- carry an id at or above it, so the next pull cannot miss them (some rows may
-- arrive twice; devices keep the highest version).
create or replace function public.sync_pull(p_cursor text default null, p_limit integer default 2000)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_next xid8 := pg_snapshot_xmin(pg_current_snapshot());
  v_from xid8;
  v_limit integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
  v_changes jsonb := '{}'::jsonb;
  v_rows jsonb;
  v_count integer;
  v_truncated boolean := false;
  e text;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  begin
    v_from := coalesce(nullif(p_cursor, ''), '0')::xid8;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_cursor';
  end;
  if v_from > '0'::xid8 and v_from < private.sync_horizon() then
    return jsonb_build_object('reset', true, 'cursor', null);
  end if;

  foreach e in array private.sync_entities() loop
    execute format(
      'select coalesce(jsonb_agg(x.r order by x.tx), ''[]''::jsonb), count(*)
       from (select to_jsonb(t) - ''field_ts'' as r, t.tx_id as tx from public.%I t
             where t.tx_id >= $1 order by t.tx_id limit $2) x',
      e
    ) into v_rows, v_count using v_from, v_limit + 1;
    if v_count > v_limit then
      v_truncated := true;
      v_rows := v_rows - v_limit;
    end if;
    v_changes := v_changes || jsonb_build_object(e, v_rows);
  end loop;

  -- A truncated answer must not advance the device: it downloads everything
  -- page by page (sync_bootstrap) and continues from a fresh cursor.
  return jsonb_build_object(
    'cursor', case when v_truncated then null else v_next::text end,
    'changes', v_changes,
    'tombstones', private.sync_tombstones(v_user, v_from),
    'truncated', v_truncated
  );
end;
$$;

comment on function public.sync_pull(text, integer) is
  'Rows changed since the cursor (RLS applies) and tombstones of hard deletes. Returns the next cursor.';

-- Full download page by page (first sign-in on a device, or after a reset).
-- Take sync_cursor() before the first page and start pulling from it after the last.
create or replace function public.sync_cursor()
returns text
language sql
stable
set search_path = ''
as $$
  select pg_snapshot_xmin(pg_current_snapshot())::text;
$$;

create or replace function public.sync_bootstrap(p_entity text, p_after uuid default null, p_limit integer default 1000)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if not (p_entity = any (private.sync_entities())) then
    raise exception using errcode = '22023', message = 'unknown_entity';
  end if;
  execute format(
    'select coalesce(jsonb_agg(x.r order by x.id), ''[]''::jsonb)
     from (select to_jsonb(t) - ''field_ts'' as r, t.id from public.%I t
           where ($1::uuid is null or t.id > $1) order by t.id limit $2) x',
    p_entity
  ) into v_rows using p_after, least(greatest(coalesce(p_limit, 1000), 1), 5000);
  return v_rows;
end;
$$;

-- Execute rights: only the public RPCs are reachable from the API.
revoke all on function public.sync_push(jsonb) from public, anon;
revoke all on function public.sync_pull(text, integer) from public, anon;
revoke all on function public.sync_cursor() from public, anon;
revoke all on function public.sync_bootstrap(text, uuid, integer) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(text, integer) to authenticated;
grant execute on function public.sync_cursor() to authenticated;
grant execute on function public.sync_bootstrap(text, uuid, integer) to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.sync_stamp()', 'private.sync_guard()', 'private.try_uuid(text)',
    'private.create_default_catalog(uuid)', 'private.on_profile_created()',
    'private.can_view_task(uuid)', 'private.can_edit_task(uuid)', 'private.task_owner(uuid)',
    'private.tasks_before_write()', 'private.task_part_before_write()', 'private.task_tags_before_write()',
    'private.habit_logs_before_write()', 'private.projects_before_write()',
    'private.log_task_activity()', 'private.log_completion_activity()', 'private.log_conflict(text, uuid, jsonb)',
    'private.record_tombstone()', 'private.sync_spec(text)', 'private.sync_entities()',
    'private.mutation_decision(uuid, uuid)', 'private.remember_mutation(uuid, uuid, text, text)',
    'private.sync_row(text, uuid)', 'private.clock_newer(bigint, uuid, jsonb)',
    'private.sync_update(text, uuid, jsonb, jsonb, bigint, uuid)', 'private.sync_insert(text, uuid, jsonb, bigint, uuid)',
    'private.sync_apply(uuid, jsonb, bigint)', 'private.sync_tombstones(uuid, xid8)', 'private.sync_horizon()'
  ] loop
    execute format('revoke all on function %s from public', f);
  end loop;
end;
$$;

-- sync_push runs as the caller and applies the per-user rate limit itself.
grant execute on function private.enforce_rate_limit(text, integer, interval) to authenticated;

-- Called from RLS policies, triggers and sync_push (which runs as the caller).
grant execute on function
  private.can_view_task(uuid), private.can_edit_task(uuid), private.task_owner(uuid), private.try_uuid(text),
  private.sync_stamp(), private.sync_guard(), private.tasks_before_write(), private.task_part_before_write(),
  private.task_tags_before_write(), private.habit_logs_before_write(), private.projects_before_write(),
  private.sync_spec(text), private.sync_entities(), private.mutation_decision(uuid, uuid),
  private.remember_mutation(uuid, uuid, text, text), private.sync_row(text, uuid), private.clock_newer(bigint, uuid, jsonb),
  private.sync_update(text, uuid, jsonb, jsonb, bigint, uuid), private.sync_insert(text, uuid, jsonb, bigint, uuid),
  private.sync_apply(uuid, jsonb, bigint), private.sync_tombstones(uuid, xid8), private.sync_horizon(),
  private.log_conflict(text, uuid, jsonb)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: attachments (private; path <task id>/<attachment id>/<file name>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- 100 MB of attachments per person on the free plan.
create or replace function private.attachment_quota_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) < 104857600
  from storage.objects o
  where o.bucket_id = 'attachments' and o.owner_id = p_user::text;
$$;
revoke all on function private.attachment_quota_ok(uuid) from public;
grant execute on function private.attachment_quota_ok(uuid) to authenticated;

create policy "attachments: task visible" on storage.objects
for select to authenticated
using (bucket_id = 'attachments' and private.can_view_task(private.try_uuid((storage.foldername(name))[1])));

create policy "attachments: task editable, within quota" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and private.can_edit_task(private.try_uuid((storage.foldername(name))[1]))
  and private.attachment_quota_ok((select auth.uid()))
);

create policy "attachments: uploader or task owner deletes" on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and (owner_id = (select auth.uid())::text
       or private.task_owner(private.try_uuid((storage.foldername(name))[1])) = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- Realtime: changes reach the owner's other devices instantly.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.projects, public.statuses, public.priorities, public.tags, public.templates,
  public.tasks, public.task_tags, public.task_milestones, public.progress_events, public.habit_logs,
  public.time_sessions, public.task_completions, public.attachments, public.comments;
