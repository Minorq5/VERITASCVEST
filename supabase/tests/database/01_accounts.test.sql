-- Accounts: sign-up trigger, username rules, RLS on profiles/settings, storage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------- helpers ---
create function pg_temp.new_user(p_email text, p_username text, p_locale text default 'ru')
returns uuid language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, extensions.crypt('orbit-Kometa-2026', extensions.gen_salt('bf')), now(),
          jsonb_build_object('username', p_username, 'locale', p_locale, 'timezone', 'Europe/Sofia'),
          '{"provider":"email","providers":["email"]}', now(), now())
  returning id;
$$;

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create temp table ids (name text primary key, id uuid);
grant select on ids to authenticated, anon;
insert into ids values
  ('alice', pg_temp.new_user('alice@example.com', 'Alice_Orbit')),
  ('bob', pg_temp.new_user('bob@example.com', 'bob', 'bg'));

-- ------------------------------------------------------------ sign-up -------
select is((select username::text from public.profiles where id = (select id from ids where name = 'alice')),
  'alice_orbit', 'username is stored in lower case');
select matches((select public_id from public.profiles where id = (select id from ids where name = 'alice')),
  '^VT-[2-9A-HJ-NP-Z]{5}$', 'public id has the VT-XXXXX format');
select is((select display_name from public.profiles where id = (select id from ids where name = 'bob')),
  'bob', 'display name defaults to the username');
select is((select locale from public.user_settings where user_id = (select id from ids where name = 'bob')),
  'bg', 'settings take the sign-up language');
select is((select timezone from public.user_settings where user_id = (select id from ids where name = 'alice')),
  'Europe/Sofia', 'settings take the sign-up time zone');
select throws_ok($$ select pg_temp.new_user('x1@example.com', 'ab') $$, '23514', 'invalid_username',
  'too short username aborts sign-up');
select throws_ok($$ select pg_temp.new_user('x2@example.com', 'admin') $$, '23514', 'invalid_username',
  'reserved username aborts sign-up');
select throws_ok($$ select pg_temp.new_user('x3@example.com', 'ALICE_ORBIT') $$, '23505', null,
  'usernames are unique regardless of case');
select throws_ok($$ select pg_temp.new_user('x4@example.com', '1orbit') $$, '23514', 'invalid_username',
  'username must start with a letter');

-- ------------------------------------------------------------- username RPC --
select is(public.check_username('Alice_Orbit') ->> 'reason', 'taken', 'check_username: taken (case-insensitive)');
select is(public.check_username('free_orbit') ->> 'available', 'true', 'check_username: available');
select is(public.check_username('a!') ->> 'reason', 'invalid', 'check_username: invalid');
select is(public.check_username('support') ->> 'reason', 'reserved', 'check_username: reserved');

-- --------------------------------------------------------------- anon -------
set local role anon;
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'visitors cannot read profiles');
select throws_ok($$ select count(*) from public.user_settings $$, '42501', null, 'visitors cannot read settings');
reset role;

-- ------------------------------------------------------------ as alice ------
select pg_temp.login((select id from ids where name = 'alice'));
set local role authenticated;

select is((select count(*)::int from public.profiles), 1, 'alice sees only her own profile');
select is((select count(*)::int from public.user_settings), 1, 'alice sees only her own settings');
select is((select username::text from public.profiles), 'alice_orbit', 'the visible profile is hers');

select lives_ok($$ update public.profiles set display_name = 'Алиса', bio = 'Летаю по орбите' $$,
  'alice edits her name and bio');
select throws_ok($$ update public.profiles set xp = 100000 $$, '42501', null, 'alice cannot grant herself XP');
select throws_ok($$ update public.profiles set level = 50 $$, '42501', null, 'alice cannot set her level');
select throws_ok($$ update public.profiles set public_id = 'VT-AAAAA' $$, '42501', null, 'alice cannot change her public id');
select throws_ok($$ update public.profiles set username = 'hacker' $$, '42501', null, 'username changes only through the RPC');
select throws_ok(
  format($$ update public.profiles set avatar_path = %L $$, (select id from ids where name = 'bob')::text || '/a.webp'),
  '23514', null, 'avatar must live in her own folder');

-- bob's rows are invisible, so updates silently touch nothing
update public.profiles set display_name = 'pwned' where id = (select id from ids where name = 'bob');
update public.user_settings set accent = 'white' where user_id = (select id from ids where name = 'bob');

select lives_ok($$ update public.user_settings set accent = 'blue', week_start = 1 $$, 'alice changes her settings');
select throws_ok($$ update public.user_settings set accent = 'neon' $$, '23514', null, 'unknown accent is rejected');
select throws_ok($$ update public.user_settings set timezone = 'Mars/Olympus' $$, '22023', 'invalid_timezone',
  'unknown time zone is rejected');

select is(public.change_username('alice_star'), 'alice_star', 'alice renames herself through the RPC');
select throws_ok($$ select public.change_username('bob') $$, '23505', 'username_taken', 'cannot take a used username');

select throws_ok(
  format($$ insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L) $$,
         (select id from ids where name = 'bob')::text || '/evil.webp', (select id from ids where name = 'alice')),
  '42501', null, 'alice cannot upload into bob''s avatar folder');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L) $$,
         (select id from ids where name = 'alice')::text || '/me.webp', (select id from ids where name = 'alice')),
  'alice uploads into her own avatar folder');
reset role;

-- ---------------------------------------------------- effects checked as admin
select is((select display_name from public.profiles where id = (select id from ids where name = 'bob')),
  'bob', 'bob''s profile was not touched by alice');

select * from finish();
rollback;
