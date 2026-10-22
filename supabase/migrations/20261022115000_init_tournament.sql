create extension if not exists pgcrypto;

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed', 'postponed')),
  format text not null default 'single_elimination_doubles',
  timezone text not null default 'Africa/Casablanca',
  scoring_config jsonb not null default '{"bestOf":3,"tiebreak":true}'::jsonb,
  bracket_capacity integer check (bracket_capacity is null or bracket_capacity >= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  login text not null unique,
  display_name text not null,
  avatar_url text,
  profile_url text,
  campus text,
  location text,
  profile_cache jsonb,
  profile_cached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  display_name text not null,
  seed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, display_name)
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete restrict,
  member_order smallint not null check (member_order in (0,1)),
  created_at timestamptz not null default now(),
  unique (team_id, player_id),
  unique (team_id, member_order)
);

create or replace function enforce_unique_player_membership_per_tournament()
returns trigger
language plpgsql
as $$
declare
  new_tournament_id uuid;
begin
  select tournament_id into new_tournament_id from teams where id = new.team_id;

  if exists (
    select 1
    from team_members tm
    join teams t on t.id = tm.team_id
    where tm.player_id = new.player_id
      and t.tournament_id = new_tournament_id
      and tm.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'Player already assigned to another team in this tournament';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_unique_player_membership_per_tournament on team_members;
create trigger trg_unique_player_membership_per_tournament
before insert or update on team_members
for each row execute function enforce_unique_player_membership_per_tournament();

create or replace function enforce_team_member_count_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from team_members where team_id = new.team_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)) >= 2 then
    raise exception 'A doubles team cannot contain more than two players';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_member_count_limit on team_members;
create trigger trg_team_member_count_limit
before insert or update on team_members
for each row execute function enforce_team_member_count_limit();

create table if not exists administrators (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null unique,
  role text not null default 'admin' check (role in ('owner','admin','operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  match_number integer not null check (match_number > 0),
  team1_id uuid references teams(id) on delete set null,
  team2_id uuid references teams(id) on delete set null,
  winner_team_id uuid references teams(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','scheduled','in_progress','completed','postponed','voided')),
  scheduled_at timestamptz,
  court text,
  score_summary text,
  completed_at timestamptz,
  source_draw_position_1 integer,
  source_draw_position_2 integer,
  result_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round_number, match_number),
  check (team1_id is null or team2_id is null or team1_id <> team2_id)
);

create unique index if not exists idx_matches_unique_team_slot
on matches (tournament_id, round_number, source_draw_position_1)
where source_draw_position_1 is not null;

create unique index if not exists idx_matches_unique_team_slot_2
on matches (tournament_id, round_number, source_draw_position_2)
where source_draw_position_2 is not null;

create table if not exists match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 5),
  team1_games smallint not null check (team1_games between 0 and 7),
  team2_games smallint not null check (team2_games between 0 and 7),
  team1_tiebreak smallint,
  team2_tiebreak smallint,
  created_at timestamptz not null default now(),
  unique (match_id, set_number),
  check (team1_games <> team2_games)
);

create table if not exists match_dependencies (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  source_match_id uuid not null references matches(id) on delete cascade,
  target_match_id uuid not null references matches(id) on delete cascade,
  target_slot text not null check (target_slot in ('team1', 'team2')),
  created_at timestamptz not null default now(),
  unique (source_match_id, target_match_id, target_slot),
  unique (target_match_id, target_slot)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  reason text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_tournament_status on matches (tournament_id, status);
create index if not exists idx_matches_tournament_scheduled on matches (tournament_id, scheduled_at);
create index if not exists idx_audit_tournament_created_at on audit_events (tournament_id, created_at desc);

alter table tournaments enable row level security;
alter table players enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table matches enable row level security;
alter table match_sets enable row level security;
alter table match_dependencies enable row level security;
alter table administrators enable row level security;
alter table audit_events enable row level security;

drop policy if exists public_tournament_read on tournaments;
create policy public_tournament_read on tournaments for select using (true);

drop policy if exists public_players_read on players;
create policy public_players_read on players for select using (true);

drop policy if exists public_teams_read on teams;
create policy public_teams_read on teams for select using (true);

drop policy if exists public_team_members_read on team_members;
create policy public_team_members_read on team_members for select using (true);

drop policy if exists public_matches_read on matches;
create policy public_matches_read on matches for select using (true);

drop policy if exists public_match_sets_read on match_sets;
create policy public_match_sets_read on match_sets for select using (true);

drop policy if exists public_match_dependencies_read on match_dependencies;
create policy public_match_dependencies_read on match_dependencies for select using (true);

drop policy if exists no_public_admins_read on administrators;
create policy no_public_admins_read on administrators for select using (false);

drop policy if exists no_public_audit_read on audit_events;
create policy no_public_audit_read on audit_events for select using (false);
