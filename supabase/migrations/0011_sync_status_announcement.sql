-- Sync-Heartbeat und Ankündigungs-Banner.
--
-- last_sync_at/last_sync_note schreibt der Cron am Ende jedes erfolgreichen
-- Laufs — bleibt der Zeitstempel stehen, zeigt die Admin-Seite eine Warnung.
-- announcement ist der Banner-Text für alle Mitglieder (leer = kein Banner).
alter table league_settings add column if not exists last_sync_at timestamptz;
alter table league_settings add column if not exists last_sync_note text;
alter table league_settings add column if not exists announcement text;
