-- Sync alle 15 Minuten direkt aus Supabase heraus anstossen.
--
-- Hintergrund: Vercel führt Cron-Jobs im Hobby-Tarif nur einmal täglich aus
-- (und dann zu beliebiger Minute innerhalb der Stunde). Für Live-Punkte
-- während laufender Spiele ist das unbrauchbar. pg_cron ist in jedem
-- Supabase-Projekt enthalten und läuft minutengenau — damit bleibt das
-- Hosting im Gratis-Tarif.
--
-- VOR dem Ausführen die beiden Platzhalter unten ersetzen:
--   <APP_URL>      z. B. https://angeli.vercel.app   (ohne Schrägstrich am Ende)
--   <CRON_SECRET>  derselbe Wert wie in den Umgebungsvariablen
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Alten Job entfernen, damit die Migration wiederholbar bleibt.
select cron.unschedule('angeli-sync')
where exists (select 1 from cron.job where jobname = 'angeli-sync');

select cron.schedule(
  'angeli-sync',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := '<APP_URL>/api/cron/sync',
    headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Kontrolle:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
