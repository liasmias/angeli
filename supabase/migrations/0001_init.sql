-- Fantasy Super League — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push` if using the CLI).

-- =========================================================================
-- Reference / league configuration
-- =========================================================================

create table if not exists league_settings (
  id smallint primary key default 1 check (id = 1), -- singleton row
  season text not null default '2026-27',
  budget_cap numeric not null default 100.0,
  squad_size int not null default 15,
  starting_size int not null default 11,
  free_transfers_per_gameweek int not null default 1,
  extra_transfer_cost int not null default 4, -- points deducted per transfer beyond the free ones
  gk_slots int not null default 2,
  def_slots int not null default 5,
  mid_slots int not null default 5,
  fwd_slots int not null default 3
);
insert into league_settings (id) values (1) on conflict (id) do nothing;

create table if not exists clubs (
  id bigint generated always as identity primary key,
  name text not null,
  short_name text,
  api_football_team_id int unique
);

create table if not exists players (
  id bigint generated always as identity primary key,
  first_name text,
  last_name text not null,
  club_id bigint references clubs(id) on delete set null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  price numeric not null default 4.0,
  api_football_player_id int unique,
  is_active boolean not null default true
);

create table if not exists gameweeks (
  id bigint generated always as identity primary key,
  season text not null,
  number int not null,
  deadline timestamptz not null,
  is_locked boolean not null default false,
  unique (season, number)
);

create table if not exists fixtures (
  id bigint generated always as identity primary key,
  gameweek_id bigint references gameweeks(id) on delete cascade,
  home_club_id bigint references clubs(id),
  away_club_id bigint references clubs(id),
  kickoff timestamptz,
  api_football_fixture_id int unique,
  status text not null default 'scheduled'
);

-- =========================================================================
-- Users
-- =========================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Stats: raw sync + admin overrides + computed points
-- =========================================================================

create table if not exists player_stats (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  fixture_id bigint references fixtures(id) on delete set null,
  minutes int not null default 0,
  goals int not null default 0,
  assists int not null default 0,
  goals_conceded int not null default 0,
  saves int not null default 0,
  penalties_saved int not null default 0,
  penalties_conceded int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  own_goals int not null default 0, -- API-Football's player-stats endpoint has no own-goal field; fill via admin override
  synced_at timestamptz not null default now(),
  unique (player_id, gameweek_id)
);

-- Same shape as player_stats, but every column is nullable: a non-null value
-- here always wins over the synced value when points are computed.
create table if not exists player_stats_overrides (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  minutes int,
  goals int,
  assists int,
  goals_conceded int,
  saves int,
  penalties_saved int,
  penalties_conceded int,
  yellow_cards int,
  red_cards int,
  own_goals int,
  note text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (player_id, gameweek_id)
);

create table if not exists fantasy_points (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  points int not null,
  breakdown jsonb,
  computed_at timestamptz not null default now(),
  unique (player_id, gameweek_id)
);

-- =========================================================================
-- Squads (FPL-style: persistent squad + per-gameweek lineup snapshot)
-- =========================================================================

create table if not exists squads (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references profiles(id) on delete cascade,
  free_transfers_remaining int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists squad_players (
  squad_id bigint not null references squads(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  is_starting boolean not null default false,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  purchase_price numeric not null,
  primary key (squad_id, player_id)
);

-- Locked-in lineup per gameweek, used to compute standings even after the
-- user changes their squad for future rounds.
create table if not exists gameweek_squads (
  id bigint generated always as identity primary key,
  squad_id bigint not null references squads(id) on delete cascade,
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  is_starting boolean not null default false,
  is_captain boolean not null default false,
  points_earned int,
  unique (squad_id, gameweek_id, player_id)
);

create table if not exists transfers (
  id bigint generated always as identity primary key,
  squad_id bigint not null references squads(id) on delete cascade,
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  player_out_id bigint references players(id),
  player_in_id bigint references players(id),
  points_cost int not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Standings (leaderboard)
-- =========================================================================

create or replace view standings
with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  coalesce(sum(gs.points_earned) filter (where gs.is_starting), 0)
    + coalesce(sum(gs.points_earned) filter (where gs.is_starting and gs.is_captain), 0)
    as total_points
from profiles p
join squads s on s.user_id = p.id
left join gameweek_squads gs on gs.squad_id = s.id
group by p.id, p.username
order by total_points desc;

-- =========================================================================
-- Helper functions
-- =========================================================================

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Creates a profile row (with a default username) whenever a new auth user signs up.
-- Prefers the username passed via supabase.auth.signUp({ options: { data: { username } } }).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Gives every new profile an empty squad to build.
create or replace function handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free_transfers int;
begin
  select free_transfers_per_gameweek into v_free_transfers from league_settings where id = 1;
  insert into squads (user_id, free_transfers_remaining)
  values (new.id, coalesce(v_free_transfers, 1));
  return new;
end;
$$;

drop trigger if exists on_profile_created on profiles;
create trigger on_profile_created
  after insert on profiles
  for each row execute function handle_new_profile();

-- Lets a user rename themselves without exposing the `role` column to client updates.
create or replace function update_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update profiles set username = p_username where id = auth.uid();
end;
$$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table league_settings enable row level security;
alter table clubs enable row level security;
alter table players enable row level security;
alter table gameweeks enable row level security;
alter table fixtures enable row level security;
alter table profiles enable row level security;
alter table player_stats enable row level security;
alter table player_stats_overrides enable row level security;
alter table fantasy_points enable row level security;
alter table squads enable row level security;
alter table squad_players enable row level security;
alter table gameweek_squads enable row level security;
alter table transfers enable row level security;

-- Read-only reference data, visible to every signed-in user; writes are
-- reserved for admins (via the app's admin panel) or the service-role key
-- (the cron sync job).
create policy "read league_settings" on league_settings for select using (true);
create policy "admin write league_settings" on league_settings for update using (is_admin()) with check (is_admin());

create policy "read clubs" on clubs for select using (true);
create policy "admin write clubs" on clubs for all using (is_admin()) with check (is_admin());

create policy "read players" on players for select using (true);
create policy "admin write players" on players for all using (is_admin()) with check (is_admin());

create policy "read gameweeks" on gameweeks for select using (true);
create policy "admin write gameweeks" on gameweeks for all using (is_admin()) with check (is_admin());

create policy "read fixtures" on fixtures for select using (true);
create policy "admin write fixtures" on fixtures for all using (is_admin()) with check (is_admin());

create policy "read player_stats" on player_stats for select using (true);
-- No client write policy: only the service-role key (cron sync) writes here.

create policy "read player_stats_overrides" on player_stats_overrides for select using (true);
create policy "admin write player_stats_overrides" on player_stats_overrides for all using (is_admin()) with check (is_admin());

create policy "read fantasy_points" on fantasy_points for select using (true);
-- No client write policy: only the service-role key (cron sync) writes here.

create policy "read profiles" on profiles for select using (true);
-- No client write policy on profiles: username changes go through update_username().

-- Squads/lineups: readable by everyone (needed for the standings view and to
-- see rivals' final gameweek scores), but only the owner (or an admin) may
-- change the actual roster and lineup picks.
create policy "read squads" on squads for select using (true);

create policy "read squad_players" on squad_players for select using (true);
create policy "own squad_players write" on squad_players for all
  using (exists (select 1 from squads s where s.id = squad_players.squad_id and (s.user_id = auth.uid() or is_admin())))
  with check (exists (select 1 from squads s where s.id = squad_players.squad_id and (s.user_id = auth.uid() or is_admin())));

create policy "read gameweek_squads" on gameweek_squads for select using (true);
create policy "own gameweek_squads write" on gameweek_squads for all
  using (exists (select 1 from squads s where s.id = gameweek_squads.squad_id and (s.user_id = auth.uid() or is_admin())))
  with check (exists (select 1 from squads s where s.id = gameweek_squads.squad_id and (s.user_id = auth.uid() or is_admin())));

create policy "read transfers" on transfers for select using (true);
create policy "own transfers write" on transfers for all
  using (exists (select 1 from squads s where s.id = transfers.squad_id and (s.user_id = auth.uid() or is_admin())))
  with check (exists (select 1 from squads s where s.id = transfers.squad_id and (s.user_id = auth.uid() or is_admin())));
