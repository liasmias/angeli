-- Spieler-Bewertung aus API-Football (games.rating, Skala ca. 6.0–10.0).
--
-- Fliesst NICHT in die Fantasy-Punkte ein — die richten sich weiterhin
-- ausschliesslich nach der Punktetabelle. Das Rating dient nur als
-- Orientierung bei der Spielerauswahl.
--
-- Nullable, weil die API es nicht für jeden Spieler liefert (typischerweise
-- fehlt es bei kurzen Einwechslungen).
alter table player_stats
  add column if not exists rating numeric(3, 1);
