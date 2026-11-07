-- Transfers und Chips vor der Deadline auch über die API geheim halten.
--
-- 0013 hat Kader und Aufstellungen vor der Deadline versteckt, `transfers`
-- und `chip_usages` aber nicht: Beide galten weiter `for select using (true)`.
-- Mit dem öffentlichen Schlüssel liessen sich so per REST die geplanten
-- Transfers (wer raus, wer rein) und Chips aller anderen für den offenen
-- Spieltag abfragen — und damit die versteckte Aufstellung weitgehend
-- rekonstruieren.
--
-- Neu gilt dieselbe Regel wie für gameweek_squads: Besitzer, Admins, sowie
-- alle, sobald die Deadline dieses Spieltags durch ist.
--
-- Folge für die Rangliste (`standings` läuft mit security_invoker): Punkt-
-- abzüge für Transfers des offenen Spieltags sieht bis zur Deadline nur der
-- Besitzer selbst; für alle anderen erscheinen sie mit der Deadline. Punkte
-- und abgeschlossene Spieltage ändern sich nicht.

drop policy if exists "read transfers" on transfers;
create policy "read transfers" on transfers for select using (
  is_admin()
  or exists (
    select 1 from squads s
    where s.id = transfers.squad_id and s.user_id = auth.uid()
  )
  or exists (
    select 1 from gameweeks g
    where g.id = transfers.gameweek_id
      and (g.is_locked or g.deadline <= now())
  )
);

drop policy if exists "read chip_usages" on chip_usages;
create policy "read chip_usages" on chip_usages for select using (
  is_admin()
  or exists (
    select 1 from squads s
    where s.id = chip_usages.squad_id and s.user_id = auth.uid()
  )
  or exists (
    select 1 from gameweeks g
    where g.id = chip_usages.gameweek_id
      and (g.is_locked or g.deadline <= now())
  )
);
