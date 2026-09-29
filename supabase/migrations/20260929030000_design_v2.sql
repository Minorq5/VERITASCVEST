-- Design V2 «Горизонт событий»: the accent is amber, blue or white.
-- Earlier accents map to the nearest new one.

alter table public.user_settings drop constraint if exists user_settings_accent;

update public.user_settings
set accent = case
  when accent in ('cyan', 'ice', 'nebula') then 'blue'
  when accent = 'solar' then 'white'
  else 'amber'
end
where accent not in ('amber', 'blue', 'white');

alter table public.user_settings alter column accent set default 'amber';
alter table public.user_settings
  add constraint user_settings_accent check (accent in ('amber', 'blue', 'white'));

-- Tag, project and status colours: the new star spectrum (rust … ash).
update public.tags set color = case color
  when 'cyan' then 'ice' when 'sky' then 'blue' when 'indigo' then 'steel' when 'violet' then 'steel'
  when 'orchid' then 'sand' when 'rose' then 'rust' when 'coral' then 'rust' when 'lime' then 'gold'
  when 'mint' then 'ice' when 'teal' then 'ice' when 'slate' then 'ash' else color end
where color in ('cyan', 'sky', 'indigo', 'violet', 'orchid', 'rose', 'coral', 'lime', 'mint', 'teal', 'slate');

update public.projects set color = case color
  when 'cyan' then 'ice' when 'sky' then 'blue' when 'indigo' then 'steel' when 'violet' then 'steel'
  when 'orchid' then 'sand' when 'rose' then 'rust' when 'coral' then 'rust' when 'lime' then 'gold'
  when 'mint' then 'ice' when 'teal' then 'ice' when 'slate' then 'ash' else color end
where color in ('cyan', 'sky', 'indigo', 'violet', 'orchid', 'rose', 'coral', 'lime', 'mint', 'teal', 'slate');

alter table public.projects alter column color set default 'amber';
alter table public.tags alter column color set default 'ash';

-- System statuses in the new colours (new accounts and existing ones).
create or replace function private.create_default_catalog(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.statuses (owner_id, system_key, color, category, sort_key)
  values
    (p_owner, 'todo', 'ash', 'todo', 'a0'),
    (p_owner, 'in_progress', 'blue', 'in_progress', 'a1'),
    (p_owner, 'paused', 'gold', 'in_progress', 'a2'),
    (p_owner, 'done', 'amber', 'done', 'a3'),
    (p_owner, 'cancelled', 'rust', 'cancelled', 'a4')
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

-- Existing system statuses: only the colour changes, through sync_push rules
-- (vt.via_sync) so every device receives the update like any other change.
select set_config('vt.via_sync', 'on', true);
update public.statuses set color = case system_key
  when 'todo' then 'ash' when 'in_progress' then 'blue' when 'paused' then 'gold'
  when 'done' then 'amber' when 'cancelled' then 'rust' else color end
where system_key is not null;
