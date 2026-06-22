begin;

create extension if not exists pgcrypto;

drop table if exists public.group_formation_rate_limits cascade;
drop table if exists public.group_formation_group_participants cascade;
drop table if exists public.group_formation_participant_keys cascade;
drop table if exists public.group_formation_participants cascade;
drop table if exists public.group_formation_groups cascade;
drop table if exists public.group_formations cascade;

create schema if not exists app_private;

create table public.group_formations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Make Software Group Formation',
  join_code text not null check (join_code ~ '^[A-Z2-9]{4}$'),
  status text not null default 'draft' check (status in ('draft', 'collecting', 'matching', 'closed')),
  public_note text not null default '',
  target_group_size integer not null default 3 check (target_group_size between 2 and 8),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  matching_started_at timestamptz,
  matched_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists group_formations_single_room_idx
  on public.group_formations ((true))
  where true;

create unique index if not exists group_formations_join_code_idx
  on public.group_formations (join_code);

create table public.group_formation_groups (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.group_formations(id) on delete cascade,
  group_number integer not null check (group_number > 0),
  label text not null,
  score jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (formation_id, group_number)
);

create table public.group_formation_participants (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.group_formations(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  age integer not null check (age between 13 and 120),
  years_experience integer not null default 0 check (years_experience between 0 and 80),
  profession text not null check (char_length(profession) between 2 and 120),
  profession_category text not null default 'other',
  group_id uuid references public.group_formation_groups(id) on delete set null,
  match_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_formation_participants_formation_idx
  on public.group_formation_participants (formation_id, created_at);

create index if not exists group_formation_participants_group_idx
  on public.group_formation_participants (group_id);

create table public.group_formation_participant_keys (
  participant_id uuid primary key references public.group_formation_participants(id) on delete cascade,
  formation_id uuid not null references public.group_formations(id) on delete cascade,
  participant_token_hash text not null,
  participant_ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (formation_id, participant_token_hash)
);

create index if not exists group_formation_participant_keys_ip_idx
  on public.group_formation_participant_keys (formation_id, participant_ip_hash);

create table public.group_formation_group_participants (
  group_id uuid not null references public.group_formation_groups(id) on delete cascade,
  participant_id uuid not null references public.group_formation_participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, participant_id),
  unique (participant_id)
);

create table public.group_formation_rate_limits (
  id bigserial primary key,
  formation_id uuid references public.group_formations(id) on delete cascade,
  token_hash text,
  ip_hash text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists group_formation_rate_limits_lookup_idx
  on public.group_formation_rate_limits (formation_id, action, token_hash, ip_hash, created_at desc);

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_group_formations_updated_at on public.group_formations;
create trigger set_group_formations_updated_at
  before update on public.group_formations
  for each row execute function app_private.set_updated_at();

drop trigger if exists set_group_formation_participants_updated_at on public.group_formation_participants;
create trigger set_group_formation_participants_updated_at
  before update on public.group_formation_participants
  for each row execute function app_private.set_updated_at();

create or replace function app_private.broadcast_group_formation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_formation_id uuid;
  changed_record_id uuid;
  changed_group_id uuid;
  changed_participant_id uuid;
begin
  if tg_table_name = 'group_formations' then
    if tg_op = 'DELETE' then
      changed_formation_id := old.id;
    else
      changed_formation_id := new.id;
    end if;
    changed_record_id := changed_formation_id;
  elsif tg_table_name = 'group_formation_group_participants' then
    if tg_op = 'DELETE' then
      changed_group_id := old.group_id;
      changed_participant_id := old.participant_id;
    else
      changed_group_id := new.group_id;
      changed_participant_id := new.participant_id;
    end if;

    select group_formation_groups.formation_id
      into changed_formation_id
      from public.group_formation_groups
      where group_formation_groups.id = changed_group_id;
  else
    if tg_op = 'DELETE' then
      changed_formation_id := old.formation_id;
      changed_record_id := old.id;
    else
      changed_formation_id := new.formation_id;
      changed_record_id := new.id;
    end if;
  end if;

  if changed_formation_id is null then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'formation_id', changed_formation_id,
      'table', tg_table_name,
      'operation', tg_op,
      'record_id', changed_record_id,
      'group_id', changed_group_id,
      'participant_id', changed_participant_id
    ),
    'changed',
    'group-formation:' || changed_formation_id::text,
    false
  );

  return null;
end;
$$;

drop trigger if exists broadcast_group_formations_change on public.group_formations;
create trigger broadcast_group_formations_change
  after insert or update or delete on public.group_formations
  for each row execute function app_private.broadcast_group_formation_change();

drop trigger if exists broadcast_group_formation_groups_change on public.group_formation_groups;
create trigger broadcast_group_formation_groups_change
  after insert or update or delete on public.group_formation_groups
  for each row execute function app_private.broadcast_group_formation_change();

drop trigger if exists broadcast_group_formation_participants_change on public.group_formation_participants;
create trigger broadcast_group_formation_participants_change
  after insert or update or delete on public.group_formation_participants
  for each row execute function app_private.broadcast_group_formation_change();

drop trigger if exists broadcast_group_formation_memberships_change on public.group_formation_group_participants;
create trigger broadcast_group_formation_memberships_change
  after insert or update or delete on public.group_formation_group_participants
  for each row execute function app_private.broadcast_group_formation_change();

alter table public.group_formations enable row level security;
alter table public.group_formation_groups enable row level security;
alter table public.group_formation_participants enable row level security;
alter table public.group_formation_participant_keys enable row level security;
alter table public.group_formation_group_participants enable row level security;
alter table public.group_formation_rate_limits enable row level security;

revoke all on table public.group_formations from anon, authenticated;
revoke all on table public.group_formation_groups from anon, authenticated;
revoke all on table public.group_formation_participants from anon, authenticated;
revoke all on table public.group_formation_participant_keys from anon, authenticated;
revoke all on table public.group_formation_group_participants from anon, authenticated;
revoke all on table public.group_formation_rate_limits from anon, authenticated;
revoke all on sequence public.group_formation_rate_limits_id_seq from anon, authenticated;

grant all on table public.group_formations to service_role;
grant all on table public.group_formation_groups to service_role;
grant all on table public.group_formation_participants to service_role;
grant all on table public.group_formation_participant_keys to service_role;
grant all on table public.group_formation_group_participants to service_role;
grant all on table public.group_formation_rate_limits to service_role;
grant usage, select on sequence public.group_formation_rate_limits_id_seq to service_role;

drop policy if exists "Formations are public" on public.group_formations;
drop policy if exists "Active formations are public" on public.group_formations;
create policy "No public formation table access"
  on public.group_formations
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Active formation participants are public" on public.group_formation_participants;
create policy "No public participant table access"
  on public.group_formation_participants
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public participant key access" on public.group_formation_participant_keys;
create policy "No public participant key access"
  on public.group_formation_participant_keys
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Active formation groups are public" on public.group_formation_groups;
create policy "No public group table access"
  on public.group_formation_groups
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "Active formation memberships are public" on public.group_formation_group_participants;
create policy "No public membership table access"
  on public.group_formation_group_participants
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No public rate limit access" on public.group_formation_rate_limits;
create policy "No public rate limit access"
  on public.group_formation_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
