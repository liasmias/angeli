-- Aufstellungen vor der Deadline auch über die API geheim halten.
--
-- Bisher galt `for select using (true)`: Jede eingeloggte Person konnte per
-- REST-Aufruf den aktuellen Kader aller anderen auslesen — also genau das
-- Abschreiben, das die Oberfläche bewusst verhindert (die öffentliche
-- Kader-Ansicht zeigt nur abgeschlossene Spieltage).
--
-- Neu gilt:
--   squad_players    (aktueller Kader)  → nur Besitzer und Admins
--   gameweek_squads  (Spieltag-Aufstellung) → Besitzer, Admins, sowie alle,
--                     sobald die Deadline dieses Spieltags durch ist
--
-- Die Rangliste bleibt korrekt: `standings` läuft zwar mit security_invoker,
-- summiert aber nur `points_earned` — und Punkte gibt es ausschliesslich für
-- Spieltage, deren Deadline längst vorbei ist.

drop policy if exists "read squad_players" on squad_players;
create policy "read squad_players" on squad_players for select using (
  is_admin()
  or exists (
    select 1 from squads s
    where s.id = squad_players.squad_id and s.user_id = auth.uid()
  )
);

drop policy if exists "read gameweek_squads" on gameweek_squads;
create policy "read gameweek_squads" on gameweek_squads for select using (
  is_admin()
  or exists (
    select 1 from squads s
    where s.id = gameweek_squads.squad_id and s.user_id = auth.uid()
  )
  or exists (
    select 1 from gameweeks g
    where g.id = gameweek_squads.gameweek_id
      and (g.is_locked or g.deadline <= now())
  )
);
