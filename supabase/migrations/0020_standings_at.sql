-- Rangliste zum Stand nach einem bestimmten Spieltag.
--
-- Die `standings`-View kennt nur den heutigen Stand. Beim Zurückblättern auf
-- einen vergangenen Spieltag stand deshalb der aktuelle Rang über einer alten
-- Aufstellung.
--
-- Bewusst als Funktion in der Datenbank statt im Anwendungscode: Der Client
-- müsste sonst alle Schnappschüsse aller Kader laden (61 × 15 × Runden) und
-- liefe in das Zeilenlimit von PostgREST — genau daran ist ein erster Versuch
-- gescheitert. Hier bleibt es eine Aggregation an Ort und Stelle.
--
-- Rechnet dieselben vier Bestandteile wie die View, begrenzt auf Runden bis
-- einschliesslich p_gameweek:
--   Startelf (bei Bench Boost auch die Bank) + Captain doppelt
--   − Transferkosten + Punkt-Gutschriften
--
-- Gutschriften tragen kein Spieltagsfeld. Sie werden der Runde zugeordnet, die
-- beim Eintragen offen war — die erste, deren Deadline nach dem Eintrag lag.
-- Ohne das erschiene eine Einstiegsgutschrift rückwirkend in Runden, an denen
-- das Mitglied gar nicht teilgenommen hat.
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
          where t.squad_id = s.id and tg.number <= p_gameweek
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

comment on function standings_at(int) is
  'Rangliste zum Stand nach Spieltag p_gameweek — dieselbe Rechnung wie die standings-View.';
