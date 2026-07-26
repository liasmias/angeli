-- Resultat-Spalten für den Spielplan und die Gegentor-Berechnung.
alter table fixtures
  add column if not exists home_goals int,
  add column if not exists away_goals int;
