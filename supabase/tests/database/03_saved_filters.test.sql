-- Smart lists (saved_filters): written through sync_push, owner-only, validated.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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

create function pg_temp.push(p_mutation jsonb) returns jsonb language sql as $$
  select public.sync_push(jsonb_build_array(p_mutation)) -> 'results' -> 0;
$$;

create temp table ids (name text primary key, id uuid);
insert into ids values
  ('alice', pg_temp.new_user('alice.lists@example.com', 'alice_lists')),
  ('bob', pg_temp.new_user('bob.lists@example.com', 'bob_lists')),
  ('list', '01900000-0000-7000-8000-0000000f0001'),
  ('bad', '01900000-0000-7000-8000-0000000f0002');
grant select on ids to authenticated;

create function pg_temp.id(p_name text) returns uuid language sql stable as $$
  select id from ids where name = p_name;
$$;

set local role authenticated;
select pg_temp.login(pg_temp.id('alice'));

select is(
  pg_temp.push(jsonb_build_object(
    'id', gen_random_uuid(), 'entity', 'saved_filters', 'op', 'insert', 'row_id', pg_temp.id('list'), 'ts', 1000,
    'data', jsonb_build_object('owner_id', pg_temp.id('alice'), 'name', 'Горит на неделе', 'color', 'amber',
                               'query', '{"due":["overdue","week"],"priorities":["high"]}'::jsonb,
                               'sort', 'priority', 'view', 'kanban', 'pinned', true)
  )) ->> 'status',
  'applied',
  'a smart list is created through sync_push');

select is((select query -> 'due' from public.saved_filters where id = pg_temp.id('list')), '["overdue", "week"]'::jsonb,
  'the query is stored as JSON');

select throws_ok(
  format($$insert into public.saved_filters (id, owner_id, name) values (gen_random_uuid(), %L, 'Напрямую')$$, pg_temp.id('alice')),
  '42501', 'use_sync_push',
  'direct writes are refused: only sync_push merges edits correctly');

select is(
  pg_temp.push(jsonb_build_object(
    'id', gen_random_uuid(), 'entity', 'saved_filters', 'op', 'insert', 'row_id', pg_temp.id('bad'), 'ts', 1000,
    'data', jsonb_build_object('owner_id', pg_temp.id('alice'), 'name', 'Странный вид', 'view', 'hologram')
  )) ->> 'status',
  'rejected',
  'an unknown view is rejected');

select ok(
  (public.sync_pull(null) -> 'changes' -> 'saved_filters') @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('list'))),
  'sync_pull brings smart lists to the other devices');

select pg_temp.login(pg_temp.id('bob'));
select is((select count(*)::int from public.saved_filters), 0, 'somebody else sees none of them');

select is(
  pg_temp.push(jsonb_build_object(
    'id', gen_random_uuid(), 'entity', 'saved_filters', 'op', 'update', 'row_id', pg_temp.id('list'), 'ts', 2000,
    'data', '{"name":"Моё"}'::jsonb, 'base', '{"name":"Горит на неделе"}'::jsonb
  )) ->> 'status',
  'rejected',
  'and cannot change them');

select pg_temp.login(pg_temp.id('alice'));
select is((select name from public.saved_filters where id = pg_temp.id('list')), 'Горит на неделе', 'the list is unchanged');

select * from finish();
rollback;
