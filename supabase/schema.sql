-- Review and run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.tournament_status as enum ('upcoming','in_progress','completed');
create type public.match_status as enum ('upcoming','live','completed','postponed','bye');

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.tournament_status not null default 'upcoming',
  timezone text not null default 'Africa/Casablanca',
  scoring_config jsonb not null default '{"format":"best_of_3","tiebreak":true}'::jsonb,
  bracket_capacity integer,
  draw_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  name text not null,
  image_path text,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(tournament_id, name),
  unique(id, tournament_id)
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  member_order smallint not null check (member_order in (1,2)),
  primary key(team_id, player_id),
  unique(team_id, member_order)
);
-- Exactly two team members is enforced by the trusted server-side team-creation
-- transaction (and should be reinforced with a deferred constraint trigger if
-- teams can be written by other trusted clients).

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number integer not null check(round_number > 0),
  position integer not null check(position >= 0),
  team_a_id uuid references public.teams(id) on delete restrict,
  team_b_id uuid references public.teams(id) on delete restrict,
  next_match_id uuid references public.matches(id) on delete set null,
  next_slot char(1) check(next_slot in ('A','B')),
  status public.match_status not null default 'upcoming',
  scheduled_at timestamptz,
  court text,
  winner_team_id uuid references public.teams(id) on delete restrict,
  result_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_id, round_number, position),
  check(team_a_id is null or team_b_id is null or team_a_id <> team_b_id)
);

create table public.match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number smallint not null check(set_number between 1 and 3),
  games_a smallint not null check(games_a >= 0),
  games_b smallint not null check(games_b >= 0),
  tiebreak_a smallint check(tiebreak_a >= 0),
  tiebreak_b smallint check(tiebreak_b >= 0),
  unique(match_id, set_number),
  check(games_a <> games_b)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  tournament_id uuid references public.tournaments(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index matches_schedule_idx on public.matches(tournament_id, scheduled_at);
create index matches_round_idx on public.matches(tournament_id, round_number, position);
create index teams_tournament_idx on public.teams(tournament_id);
create index audit_events_match_idx on public.audit_events(match_id, created_at desc);

alter table public.tournaments enable row level security;
alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;
alter table public.audit_events enable row level security;

-- Public read access for tournament information only.
create policy "public read tournaments" on public.tournaments for select using (true);
create policy "public read players" on public.players for select using (true);
create policy "public read teams" on public.teams for select using (true);
create policy "public read team members" on public.team_members for select using (true);
create policy "public read matches" on public.matches for select using (true);
create policy "public read match sets" on public.match_sets for select using (true);
-- No public write policies. Trusted server operations must verify admin identity
-- and perform writes using narrowly scoped functions or a server-only service key.
-- Do not expose service-role keys to browser code.
-- Audit events intentionally have no public select/insert/update/delete policy.

-- Durable application state used by the public bracket and the admin control room.
-- Only the server-side service-role client may write this row; never expose that key in the browser.
create table if not exists public.tournament_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.tournament_state enable row level security;
-- No client policies: public reads and admin writes go through server routes.
