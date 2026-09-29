-- Tasks and synchronisation: idempotency, per-field merge, RLS, tombstones.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- ---------------------------------------------------------------- helpers ---
create function pg_temp.new_user(p_email text, p_username text)
returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, extensions.crypt('orbit-Kometa-2026', extensions.gen_salt('bf')), now(),
          jsonb_build_object('username', p_username, 'locale', 'ru', 'timezone', 'Europe/Moscow'),
          '{"provider":"email","providers":["email"]}', now(), now())
  returning id;
$$;

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- One mutation → its result object.
create function pg_temp.push(p_mutation jsonb) returns jsonb language sql as $$
  select public.sync_push(jsonb_build_array(p_mutation)) -> 'results' -> 0;
$$;

create function pg_temp.mut(p_entity text, p_op text, p_row uuid, p_data jsonb, p_base jsonb default null,
                            p_ts bigint default 1000, p_id uuid default gen_random_uuid())
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', p_id, 'entity', p_entity, 'op', p_op, 'row_id', p_row,
                                              'data', p_data, 'base', p_base, 'ts', p_ts));
$$;

create temp table ids (name text primary key, id uuid);
grant select on ids to authenticated, anon;
insert into ids values
  ('alice', pg_temp.new_user('alice.tasks@example.com', 'alice_tasks')),
  ('bob', pg_temp.new_user('bob.tasks@example.com', 'bob_tasks')),
  ('task', '01900000-0000-7000-8000-00000000a001'),
  ('task2', '01900000-0000-7000-8000-00000000a002'),
  ('child', '01900000-0000-7000-8000-00000000a003'),
  ('m_insert', '01900000-0000-7000-8000-00000000b001'),
  ('project', '01900000-0000-7000-8000-00000000c001'),
  ('habit_day', '01900000-0000-7000-8000-00000000d001');
grant select on ids to authenticated;

create function pg_temp.id(p_name text) returns uuid language sql stable as $$
  select id from ids where name = p_name;
$$;

-- ---------------------------------------------------------- catalog ---------
select is((select count(*)::int from public.statuses where owner_id = pg_temp.id('alice')), 5,
  'new account gets the 5 system statuses');
select is((select count(*)::int from public.priorities where owner_id = pg_temp.id('alice')), 4,
  'new account gets the 4 system priorities');

-- ---------------------------------------------------------- as alice --------
set local role authenticated;
select pg_temp.login(pg_temp.id('alice'));

select throws_ok(
  format($$ insert into public.tasks (id, owner_id, title) values (gen_random_uuid(), %L, 'direct') $$, pg_temp.id('alice')),
  '42501', 'use_sync_push', 'direct writes are refused: everything goes through sync_push');

select is(pg_temp.push(pg_temp.mut('tasks', 'insert', pg_temp.id('task'),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'title', 'Сходить в зал', 'due_date', '2026-10-01',
                     'due_time', '18:00', 'timezone', 'Europe/Moscow'),
  p_id => pg_temp.id('m_insert'))) ->> 'status', 'applied', 'insert through sync_push is applied');
select is((select due_at from public.tasks where id = pg_temp.id('task')), '2026-10-01 15:00:00+00'::timestamptz,
  'due_at is computed in the task time zone');

select is(pg_temp.push(pg_temp.mut('tasks', 'insert', pg_temp.id('task'),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'title', 'Сходить в зал'),
  p_id => pg_temp.id('m_insert'))) ->> 'status', 'duplicate', 'a repeated mutation is recognised');
select is((select count(*)::int from public.tasks where id = pg_temp.id('task')), 1,
  'a repeated mutation never creates a second task');
select is(pg_temp.push(pg_temp.mut('tasks', 'insert', pg_temp.id('task'),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'title', 'Сходить в зал'))) ->> 'status', 'applied',
  'the same task inserted again under a new mutation id is merged, not duplicated');
select is((select count(*)::int from public.tasks where id = pg_temp.id('task')), 1, 'still exactly one task');

-- Clean edit: the base matches.
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'),
  '{"title": "Зал, ноги"}', '{"title": "Сходить в зал"}', 2000)) -> 'conflicts', '[]'::jsonb,
  'an edit on top of the current value has no conflict');
select is((select title from public.tasks where id = pg_temp.id('task')), 'Зал, ноги', 'the edit is applied');

-- Concurrent edits of one field: the later edit time wins, in either arrival order.
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'),
  '{"title": "Старая правка"}', '{"title": "Сходить в зал"}', 1500)) -> 'conflicts' -> 0 ->> 'kept', 'Зал, ноги',
  'an older concurrent edit loses');
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'),
  '{"title": "Новая правка"}', '{"title": "Сходить в зал"}', 3000)) -> 'conflicts' -> 0 ->> 'kept', 'Новая правка',
  'a newer concurrent edit wins');
select is((select count(*)::int from public.activity_log where task_id = pg_temp.id('task') and action = 'conflict'), 2,
  'both conflicts are kept in the history with the losing value');

-- Different fields of the same task merge.
select pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'), '{"estimate_minutes": 30}', '{"estimate_minutes": null}', 4000));
select pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'), '{"icon": "dumbbell"}', '{"icon": null}', 3900));
select results_eq(
  format($$ select estimate_minutes, icon from public.tasks where id = %L $$, pg_temp.id('task')),
  $$ values (30, 'dumbbell'::text) $$,
  'edits of different fields from two devices are both kept');

-- Delete on one device + edit on another: nothing is lost.
select pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'), jsonb_build_object('deleted_at', now()), '{"deleted_at": null}', 5000));
select pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'), '{"description_text": "3 подхода"}', '{"description_text": ""}', 4800));
select results_eq(
  format($$ select deleted_at is not null, description_text, deleted_by from public.tasks where id = %L $$, pg_temp.id('task')),
  format($$ values (true, '3 подхода'::text, %L::uuid) $$, pg_temp.id('alice')),
  'a deletion and an edit made elsewhere are both applied; the server records who deleted');

-- Server-owned fields and bad input.
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'), jsonb_build_object('owner_id', pg_temp.id('bob')), '{}')) ->> 'status',
  'rejected', 'the owner cannot be changed');
select matches(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task'), '{"due_date": "not a date"}', '{}')) ->> 'error',
  '^22', 'an invalid value is rejected by the column type');
select is((select jsonb_agg(r ->> 'status') from jsonb_array_elements(public.sync_push(jsonb_build_array(
  pg_temp.mut('tasks', 'update', pg_temp.id('task'), '{"type": "unknown"}', '{"type": "normal"}', 6000),
  pg_temp.mut('tasks', 'update', pg_temp.id('task'), '{"progress_target": 10}', '{"progress_target": null}', 6000)
)) -> 'results') r), '["rejected", "applied"]'::jsonb, 'one rejected mutation does not block the rest of the batch');

-- Normalisation instead of rejection.
select pg_temp.push(pg_temp.mut('tasks', 'insert', pg_temp.id('task2'),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'title', 'Без даты', 'due_time', '10:00', 'timezone', 'Europe/Moscow')));
select is((select due_time from public.tasks where id = pg_temp.id('task2')), null::time,
  'a time without a date is dropped instead of rejecting the change');
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task2'), '{"timezone": "Mars/Olympus"}', '{"timezone": "Europe/Moscow"}')) ->> 'error',
  '22023:invalid_timezone', 'unknown time zones are rejected');

-- Completion stamps belong to the server.
select pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task2'),
  jsonb_build_object('completed_at', now(), 'completed_by', pg_temp.id('bob')), '{"completed_at": null, "completed_by": null}'));
select is((select completed_by from public.tasks where id = pg_temp.id('task2')), pg_temp.id('alice'),
  'completed_by is the person who completed, whatever the device claims');

-- Subtasks cannot form a cycle.
select pg_temp.push(pg_temp.mut('tasks', 'insert', pg_temp.id('child'),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'title', 'Подзадача', 'parent_id', pg_temp.id('task2'))));
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task2'),
  jsonb_build_object('parent_id', pg_temp.id('child')), '{"parent_id": null}')) ->> 'error', '23514:task_cycle',
  'a task cannot become a subtask of its own subtask');

-- Progress as events: two devices adding +1 give +2.
select pg_temp.push(pg_temp.mut('progress_events', 'insert', gen_random_uuid(),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('alice'), 'kind', 'delta', 'value', 1)));
select pg_temp.push(pg_temp.mut('progress_events', 'insert', gen_random_uuid(),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('alice'), 'kind', 'delta', 'value', 1)));
select is((select sum(value)::int from public.progress_events where task_id = pg_temp.id('task2')), 2,
  'progress events from two devices add up');

-- Habit day: the same day marked on two devices is one row.
select pg_temp.push(pg_temp.mut('habit_logs', 'insert', pg_temp.id('habit_day'),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('alice'), 'date', '2026-09-28', 'status', 'done'), p_ts => 100));
select is(pg_temp.push(pg_temp.mut('habit_logs', 'insert', pg_temp.id('habit_day'),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('alice'), 'date', '2026-09-28', 'status', 'skip'), p_ts => 200)) ->> 'status',
  'applied', 'the second device''s mark of the same day merges into the first');
select results_eq(
  format($$ select count(*)::int, max(status) from public.habit_logs where task_id = %L $$, pg_temp.id('task2')),
  $$ values (1, 'skip'::text) $$, 'one row per habit day; the later mark wins');
select pg_temp.push(pg_temp.mut('habit_logs', 'insert', gen_random_uuid(),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('alice'), 'date', '2026-09-29', 'status', 'freeze')));
select is(pg_temp.push(pg_temp.mut('habit_logs', 'insert', gen_random_uuid(),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('alice'), 'date', '2026-09-30', 'status', 'freeze'))) ->> 'error',
  '23514:freeze_once_a_week', 'a habit can be frozen once a week');

-- Own project for later checks.
select pg_temp.push(pg_temp.mut('projects', 'insert', pg_temp.id('project'),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'name', 'Дом')));

-- Pull sees everything of mine.
select ok(jsonb_array_length(public.sync_pull(null) -> 'changes' -> 'tasks') = 3, 'sync_pull returns my tasks');

-- Hard delete leaves a tombstone.
select pg_temp.push(pg_temp.mut('tasks', 'delete', pg_temp.id('child'), '{}'));
select ok(public.sync_pull(null) -> 'tombstones' @> jsonb_build_array(jsonb_build_object('entity', 'tasks', 'id', pg_temp.id('child'))),
  'a purged task comes back as a tombstone for my other devices');

-- ------------------------------------------------------------- as bob -------
select pg_temp.login(pg_temp.id('bob'));
select is((select count(*)::int from public.tasks), 0, 'bob sees none of alice''s tasks');
select is(jsonb_array_length(public.sync_pull(null) -> 'changes' -> 'tasks'), 0, 'bob''s pull returns none of alice''s tasks');
select is(jsonb_array_length(public.sync_pull(null) -> 'tombstones'), 0, 'bob does not learn about alice''s deletions');
select is(pg_temp.push(pg_temp.mut('tasks', 'update', pg_temp.id('task2'), '{"title": "взлом"}', '{}')) ->> 'error',
  'P0002:not_found', 'bob cannot edit alice''s task');
select matches(pg_temp.push(pg_temp.mut('tasks', 'insert', gen_random_uuid(),
  jsonb_build_object('owner_id', pg_temp.id('alice'), 'title', 'подкинуть'))) ->> 'error',
  '^42501', 'bob cannot create a task in alice''s name');
select matches(pg_temp.push(pg_temp.mut('progress_events', 'insert', gen_random_uuid(),
  jsonb_build_object('task_id', pg_temp.id('task2'), 'user_id', pg_temp.id('bob'), 'kind', 'delta', 'value', 100))) ->> 'error',
  '^42501', 'bob cannot add progress to alice''s task');
select is(pg_temp.push(pg_temp.mut('tasks', 'insert', gen_random_uuid(),
  jsonb_build_object('owner_id', pg_temp.id('bob'), 'title', 'в чужой проект', 'project_id', pg_temp.id('project')))) ->> 'error',
  '23503:project_not_found', 'bob cannot file his task under alice''s project');
select is(pg_temp.push(pg_temp.mut('tasks', 'insert', gen_random_uuid(),
  jsonb_build_object('owner_id', pg_temp.id('bob'), 'title', 'подзадача чужой', 'parent_id', pg_temp.id('task2')))) ->> 'error',
  '23503:parent_not_found', 'bob cannot hang a subtask under alice''s task');

-- ------------------------------------------------------------- anon ---------
reset role;
set local role anon;
select throws_ok($$ select public.sync_push('[]') $$, '42501', null, 'visitors cannot push');
select throws_ok($$ select public.sync_pull(null) $$, '42501', null, 'visitors cannot pull');
reset role;

select * from finish();
rollback;
