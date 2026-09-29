-- ============================================================================
-- Veritas Tasks · Accounts
-- Profiles, per-user settings, public IDs (VT-XXXXX), username rules,
-- rate limiting, avatar storage. Every table has Row Level Security.
-- ============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Private schema: helpers that the HTTP API never exposes.
-- RLS policies may call a few of them, so `authenticated` gets USAGE only;
-- EXECUTE is granted function by function.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting: fixed windows per key (user id or client IP + action).
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create or replace function private.hit_rate_limit(p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seconds double precision := extract(epoch from p_window);
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- Raises SQLSTATE PT429: PostgREST answers HTTP 429 with code "PT429".
create or replace function private.enforce_rate_limit(p_key text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.hit_rate_limit(p_key, p_max, p_window) then
    raise exception using errcode = 'PT429', message = 'rate_limited';
  end if;
end;
$$;

-- The caller's IP as seen by the API gateway (first X-Forwarded-For entry).
create or replace function private.request_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers json;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  return coalesce(
    nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    'unknown'
  );
exception when others then
  return 'unknown';
end;
$$;

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------
create or replace function private.is_valid_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username ~ '^[a-z][a-z0-9_]{2,23}$';
$$;

create or replace function private.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(p_username) = any (array[
    'admin', 'administrator', 'root', 'system', 'support', 'help', 'moderator', 'mod',
    'veritas', 'veritastasks', 'official', 'team', 'staff', 'api', 'www', 'app', 'mail',
    'settings', 'profile', 'login', 'register', 'signup', 'signin', 'logout', 'auth',
    'null', 'undefined', 'anonymous', 'everyone', 'nobody', 'me', 'you', 'user', 'users',
    'design', 'today', 'inbox', 'galaxy', 'quest', 'quests', 'friends', 'u'
  ]);
$$;

-- ---------------------------------------------------------------------------
-- Public IDs: "VT-" + 5 characters without look-alikes (no 0/O or 1/I).
-- 32^5 ≈ 33.5 million combinations.
-- ---------------------------------------------------------------------------
create or replace function private.generate_public_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZL';
  bytes bytea;
  candidate text;
begin
  loop
    bytes := extensions.gen_random_bytes(5);
    candidate := 'VT-';
    for i in 0..4 loop
      candidate := candidate || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.public_id = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: the public face of an account.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_path text,
  public_id text not null unique,
  xp bigint not null default 0,
  level smallint not null default 1,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  searchable boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (private.is_valid_username(username::text)),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint profiles_bio_length check (char_length(bio) <= 280),
  constraint profiles_public_id_format check (public_id ~ '^VT-[2-9A-HJ-NP-Z]{5}$'),
  constraint profiles_avatar_in_own_folder check (avatar_path is null or avatar_path like id::text || '/%'),
  constraint profiles_xp_non_negative check (xp >= 0),
  constraint profiles_level_range check (level between 1 and 50),
  constraint profiles_streaks_non_negative check (current_streak >= 0 and best_streak >= 0)
);

comment on table public.profiles is 'Public profile of an account. Readable by the owner (and later friends / co-members).';

create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Settings: private per-account preferences (device-level ones live on the device).
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  accent text not null default 'cyan',
  week_start smallint not null default 1,
  time_format text not null default '24h',
  sound_enabled boolean not null default true,
  sound_volume real not null default 0.8,
  sound_ui real not null default 0.7,
  sound_fx real not null default 0.9,
  sound_ambient real not null default 0.5,
  ambient_enabled boolean not null default false,
  haptics boolean not null default true,
  friend_requests text not null default 'everyone',
  show_in_leaderboard boolean not null default true,
  notifications jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_locale check (locale in ('ru', 'en', 'bg')),
  constraint user_settings_accent check (accent in ('cyan', 'ice', 'aurora', 'nebula', 'plasma', 'solar')),
  constraint user_settings_week_start check (week_start in (0, 1, 6)),
  constraint user_settings_time_format check (time_format in ('24h', '12h')),
  constraint user_settings_volumes check (
    sound_volume between 0 and 1 and sound_ui between 0 and 1
    and sound_fx between 0 and 1 and sound_ambient between 0 and 1
  ),
  constraint user_settings_friend_requests check (friend_requests in ('everyone', 'friends_of_friends', 'nobody')),
  constraint user_settings_notifications_object check (jsonb_typeof(notifications) = 'object'),
  constraint user_settings_timezone_length check (char_length(timezone) between 1 and 64)
);

comment on table public.user_settings is 'Private preferences of an account. Only the owner can read or change them.';

create or replace function private.validate_user_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An unknown time zone name would break every date calculation later.
  begin
    perform now() at time zone new.timezone;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end;
  return new;
end;
$$;

create trigger user_settings_validate before insert or update of timezone on public.user_settings
for each row execute function private.validate_user_settings();

create trigger user_settings_touch before update on public.user_settings
for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New account → profile + settings. Username, locale and time zone come from
-- the sign-up metadata; an invalid or taken username aborts the sign-up.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_display text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'en');
  v_timezone text := coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC');
begin
  if not private.is_valid_username(v_username) or private.is_reserved_username(v_username) then
    raise exception using errcode = '23514', message = 'invalid_username';
  end if;
  if v_locale not in ('ru', 'en', 'bg') then
    v_locale := 'en';
  end if;
  begin
    perform now() at time zone v_timezone;
  exception when others then
    v_timezone := 'UTC';
  end;
  if char_length(v_display) not between 1 and 60 then
    v_display := v_username;
  end if;

  insert into public.profiles (id, username, display_name, public_id)
  values (new.id, v_username, v_display, private.generate_public_id());

  insert into public.user_settings (user_id, locale, timezone)
  values (new.id, v_locale, v_timezone);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- A repeated sign-up with the same, still unconfirmed email may carry a new
-- username: keep the profile in step while nobody could have seen it yet.
create or replace function private.handle_unconfirmed_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if new.email_confirmed_at is null
     and v_username is distinct from lower(btrim(coalesce(old.raw_user_meta_data ->> 'username', '')))
     and private.is_valid_username(v_username)
     and not private.is_reserved_username(v_username)
     and not exists (select 1 from public.profiles p where p.username = v_username::extensions.citext and p.id <> new.id)
  then
    update public.profiles set username = v_username where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_metadata_updated
after update of raw_user_meta_data on auth.users
for each row execute function private.handle_unconfirmed_user_update();

-- ---------------------------------------------------------------------------
-- RPC: live username availability (also for visitors on the sign-up form).
-- ---------------------------------------------------------------------------
create or replace function public.check_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_self uuid := auth.uid();
begin
  if not private.hit_rate_limit('check_username:' || coalesce(v_self::text, private.request_ip()), 60, interval '1 minute') then
    return jsonb_build_object('available', null, 'reason', 'rate_limited');
  end if;
  if not private.is_valid_username(v_username) then
    return jsonb_build_object('available', false, 'reason', 'invalid');
  end if;
  if private.is_reserved_username(v_username) then
    return jsonb_build_object('available', false, 'reason', 'reserved');
  end if;
  if exists (
    select 1 from public.profiles p
    where p.username = v_username::extensions.citext
      and p.id is distinct from v_self
  ) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('available', true, 'reason', null);
end;
$$;

comment on function public.check_username(text) is 'Is this username free? Returns {available, reason}. Rate-limited per user or IP.';

-- ---------------------------------------------------------------------------
-- RPC: change own username (validated, unique, at most 5 changes a day).
-- ---------------------------------------------------------------------------
create or replace function public.change_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
begin
  if v_self is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if not private.is_valid_username(v_username) or private.is_reserved_username(v_username) then
    raise exception using errcode = '22023', message = 'invalid_username';
  end if;
  perform private.enforce_rate_limit('change_username:' || v_self, 5, interval '1 day');
  begin
    update public.profiles set username = v_username where id = v_self;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'username_taken';
  end;
  return v_username;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table private.rate_limits enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
revoke all on table private.rate_limits from anon, authenticated;

grant select on table public.profiles to authenticated;
-- Username goes through change_username(); XP, level, IDs are server-owned.
grant update (display_name, bio, avatar_path, searchable, last_seen_at) on table public.profiles to authenticated;

grant select on table public.user_settings to authenticated;
grant update (
  locale, timezone, accent, week_start, time_format,
  sound_enabled, sound_volume, sound_ui, sound_fx, sound_ambient, ambient_enabled, haptics,
  friend_requests, show_in_leaderboard, notifications, onboarding_completed_at
) on table public.user_settings to authenticated;

create policy "profiles: owner reads" on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy "profiles: owner updates" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "settings: owner reads" on public.user_settings
for select to authenticated
using (user_id = (select auth.uid()));

create policy "settings: owner updates" on public.user_settings
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on function public.check_username(text) from public;
grant execute on function public.check_username(text) to anon, authenticated;
revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

revoke all on function private.hit_rate_limit(text, integer, interval) from public;
revoke all on function private.enforce_rate_limit(text, integer, interval) from public;
revoke all on function private.generate_public_id() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_unconfirmed_user_update() from public;

-- ---------------------------------------------------------------------------
-- Storage: avatars (public read by URL, write only into your own folder).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: owner lists" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner uploads" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner replaces" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: owner deletes" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Realtime: profile and settings changes reach the owner's other devices.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles, public.user_settings;
