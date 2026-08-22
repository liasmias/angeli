-- Wildcard storniert die Transferabzüge ihres Spieltags.
--
-- Bisher wurde der Abzug beim Speichern in `transfers.points_cost`
-- geschrieben: War die Wildcard zu diesem Zeitpunkt aktiv, kostete der
-- Transfer nichts, sonst vier Punkte. Wer erst transferierte und die
-- Wildcard danach aktivierte, blieb auf den Abzügen sitzen — die Zeilen
-- lagen längst in der Datenbank und wurden von `activateChip` nicht
-- angefasst.
--
-- Neu wird beim Auswerten entschieden statt beim Speichern: Abzüge aus
-- einem Spieltag, an dem der Kader die Wildcard gespielt hat, zählen nicht.
-- Damit wirkt die Wildcard rückwirkend auf die ganze Runde, und die
-- Rücknahme des Chips stellt die Abzüge von selbst wieder her. FPL hält es
-- genauso: Wer die Wildcard nach bereits gebuchten Hits zieht, bekommt sie
-- erlassen.
--
-- Die Spalte bleibt, wie sie ist — sie dokumentiert weiterhin, was der
-- einzelne Transfer im Moment der Buchung gekostet hat.
create or replace view standings
with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  coalesce(sum(gs.points_earned) filter (where gs.is_starting or bb.squad_id is not null), 0)
    + coalesce(sum(gs.points_earned) filter (where gs.is_starting and gs.is_captain), 0)
    - coalesce((
        select sum(t.points_cost)
        from transfers t
        where t.squad_id = s.id
          and not exists (
            select 1 from chip_usages cu
            where cu.squad_id = s.id
              and cu.chip = 'wildcard'
              and cu.gameweek_id = t.gameweek_id
          )
      ), 0)
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

-- Dieselbe Regel für den historischen Stand.
create or replace function standings_at(p_gameweek int)
returns table (user_id uuid, username text, total_points bigint)
language sql
stable
security invoker
as $$
  select
    p.id as user_id,
    p.username,
    coalesce(sum(gs.points_earned) filter (where gs.is_starting or bb.squad_id is not null), 0)
      + coalesce(sum(gs.points_earned) filter (where gs.is_starting and gs.is_captain), 0)
      - coalesce((
          select sum(t.points_cost)
          from transfers t
          join gameweeks tg on tg.id = t.gameweek_id
          where t.squad_id = s.id
            and tg.number <= p_gameweek
            and not exists (
              select 1 from chip_usages cu
              where cu.squad_id = s.id
                and cu.chip = 'wildcard'
                and cu.gameweek_id = t.gameweek_id
            )
        ), 0)
      + coalesce((
          select sum(a.points)
          from point_adjustments a
          where a.squad_id = s.id
            and coalesce(
                  (select min(g2.number) from gameweeks g2 where g2.deadline > a.created_at),
                  (select max(g3.number) from gameweeks g3)
                ) <= p_gameweek
        ), 0)
      as total_points
  from profiles p
  join squads s on s.user_id = p.id
  left join gameweek_squads gs
    on gs.squad_id = s.id
   and gs.gameweek_id in (select g.id from gameweeks g where g.number <= p_gameweek)
  left join chip_usages bb
    on bb.squad_id = s.id
   and bb.gameweek_id = gs.gameweek_id
   and bb.chip = 'bench_boost'
  where not p.is_blocked
  group by p.id, p.username, s.id
  order by total_points desc;
$$;
