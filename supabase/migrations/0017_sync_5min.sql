-- Sync-Takt von 15 auf 5 Minuten verkuerzen.
--
-- Bei ~7 API-Anfragen je Lauf sind das ~2000 von 7500 taeglichen Anfragen
-- des API-Football-Kontingents — Live-Punkte fuehlen sich damit nahezu
-- in Echtzeit an. Wiederholbar: alter_job aendert nur den Zeitplan des
-- bestehenden Jobs aus Migration 0009.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'angeli-sync'),
  schedule := '*/5 * * * *'
);

-- Kontrolle:
--   select jobname, schedule, active from cron.job;
