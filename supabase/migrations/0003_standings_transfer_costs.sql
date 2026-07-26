-- Transferkosten von der Punktzahl abziehen.
-- Vorher wurden `transfers.points_cost` zwar erfasst, aber nie verrechnet —
-- zusätzliche Transfers waren damit faktisch gratis.
create or replace view standings
with (security_invoker = true) as
select
  p.id as user_id,
  p.username,
  coalesce(sum(gs.points_earned) filter (where gs.is_starting), 0)
    + coalesce(sum(gs.points_earned) filter (where gs.is_starting and gs.is_captain), 0)
    - coalesce((select sum(t.points_cost) from transfers t where t.squad_id = s.id), 0)
    as total_points
from profiles p
join squads s on s.user_id = p.id
left join gameweek_squads gs on gs.squad_id = s.id
group by p.id, p.username, s.id
order by total_points desc;
