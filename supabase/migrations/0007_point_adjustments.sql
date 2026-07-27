-- Manuelle Punktekorrekturen, z. B. Startguthaben für Nachzügler.
--
-- Bewusst als Tabelle statt als Spalte auf `squads`: So bleibt jede
-- Korrektur einzeln nachvollziehbar (wer, wann, warum) und lässt sich
-- gezielt zurücknehmen, statt einen Gesamtwert zu überschreiben.
create table if not exists point_adjustments (
  id bigint generated always as identity primary key,
  squad_id bigint not null references squads(id) on delete cascade,
  points int not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists point_adjustments_squad_idx on point_adjustments (squad_id);

alter table point_adjustments enable row level security;

drop policy if exists "read point_adjustments" on point_adjustments;
drop policy if exists "admin write point_adjustments" on point_adjustments;

-- Für alle einsehbar (Transparenz in der Liga), schreiben nur Admins.
create policy "read point_adjustments" on point_adjustments for select using (true);
create policy "admin write point_adjustments" on point_adjustments for all
  using (is_admin()) with check (is_admin());

-- Rangliste um die Korrekturen ergänzen.
create or replace view standings
with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  coalesce(sum(gs.points_earned) filter (where gs.is_starting or bb.squad_id is not null), 0)
    + coalesce(sum(gs.points_earned) filter (where gs.is_starting and gs.is_captain), 0)
    - coalesce((select sum(t.points_cost) from transfers t where t.squad_id = s.id), 0)
    + coalesce((select sum(a.points) from point_adjustments a where a.squad_id = s.id), 0)
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
