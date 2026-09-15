-- Statistik je Partie statt je Spieltag.
--
-- player_stats hielt seit 0001 höchstens eine Zeile je Spieler und Spieltag.
-- Das trug, solange jeder Verein pro Runde einmal spielte. Spieltag 8 ist die
-- erste Double Gameweek: SG, SIO, THU, GC, LUG und SFC treten zweimal an, weil
-- die am 23.08. verschobenen Partien am 15./16.09. nachgeholt werden. Der Sync
-- hätte beim Verarbeiten der zweiten Partie die Zeile der ersten überschrieben
-- — Tore, Vorlagen, Minuten und Karten des ersten Spiels wären ersatzlos weg
-- gewesen, ohne Fehlermeldung.
--
-- NULLS NOT DISTINCT ist hier der Kern: Von Hand getragene Zeilen haben keine
-- Partie (fixture_id is null). Mit der Standardbehandlung gälten mehrere NULL
-- als verschieden, und für denselben Spieler entstünden beliebig viele
-- händische Zeilen. So bleibt es bei höchstens einer — und die Bedingung ist
-- als ON-CONFLICT-Ziel verwendbar, anders als ein partieller Index.

alter table player_stats
  drop constraint if exists player_stats_player_id_gameweek_id_key;

alter table player_stats
  add constraint player_stats_spieler_runde_partie_key
  unique nulls not distinct (player_id, gameweek_id, fixture_id);

-- Admin-Korrekturen ebenfalls auf die Partie beziehen: Bei zwei Partien in
-- derselben Runde muss feststehen, welche gemeint ist. Bestehende Korrekturen
-- behalten fixture_id null und gelten damit weiter für die ganze Runde —
-- in allen bisherigen Runden gab es ohnehin nur eine Partie je Verein.
alter table player_stats_overrides
  add column if not exists fixture_id bigint references fixtures(id) on delete set null;

alter table player_stats_overrides
  drop constraint if exists player_stats_overrides_player_id_gameweek_id_key;

alter table player_stats_overrides
  add constraint player_stats_overrides_spieler_runde_partie_key
  unique nulls not distinct (player_id, gameweek_id, fixture_id);

-- Nachschlagen der Zeilen einer Runde je Spieler — der häufigste Zugriff der
-- Punkteberechnung, die jetzt über alle Partien einer Runde summiert.
create index if not exists player_stats_spieler_runde_idx
  on player_stats (player_id, gameweek_id);
