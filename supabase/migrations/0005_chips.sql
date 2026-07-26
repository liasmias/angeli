-- Chips: Wildcard und Bench Boost, je einmal pro Saison und Kader.
--
--  wildcard    → alle Transfers dieses Spieltags sind gratis
--  bench_boost → an diesem Spieltag zählen auch die Punkte der Bank
create table if not exists chip_usages (
  id bigint generated always as identity primary key,
  squad_id bigint not null references squads(id) on delete cascade,
  chip text not null check (chip in ('wildcard', 'bench_boost')),
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  activated_at timestamptz not null default now(),
  -- Genau ein Einsatz pro Chip und Saison; erzwungen durch die Datenbank,
  -- nicht nur durch die Anwendungslogik.
  unique (squad_id, chip)
);

alter table chip_usages enable row level security;

-- `drop ... if exists` davor, damit die Migration mehrfach laufen kann:
-- Postgres kennt kein `create policy if not exists`.
drop policy if exists "read chip_usages" on chip_usages;
drop policy if exists "own chip_usages write" on chip_usages;

create policy "read chip_usages" on chip_usages for select using (true);
create policy "own chip_usages write" on chip_usages for all
  using (exists (select 1 from squads s where s.id = chip_usages.squad_id and (s.user_id = auth.uid() or is_admin())))
  with check (exists (select 1 from squads s where s.id = chip_usages.squad_id and (s.user_id = auth.uid() or is_admin())));

-- Rangliste: am Bench-Boost-Spieltag zählen alle 15 Spieler statt nur der Startelf.
create or replace view standings
with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  coalesce(sum(gs.points_earned) filter (where gs.is_starting or bb.squad_id is not null), 0)
    + coalesce(sum(gs.points_earned) filter (where gs.is_starting and gs.is_captain), 0)
    - coalesce((select sum(t.points_cost) from transfers t where t.squad_id = s.id), 0)
    as total_points
from profiles p
join squads s on s.user_id = p.id
left join gameweek_squads gs on gs.squad_id = s.id
left join chip_usages bb
  on bb.squad_id = s.id
 and bb.gameweek_id = gs.gameweek_id
 and bb.chip = 'bench_boost'
where not p.is_blocked
group by p.id, p.username, s.id
order by total_points desc;
