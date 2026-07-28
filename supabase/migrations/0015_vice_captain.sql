-- Vize-Captain in der Spieltag-Aufstellung.
--
-- Spielt der Captain keine Minute, wandert die Binde nach Spielende auf den
-- Vize — analog zur automatischen Einwechslung. Danach greift die doppelte
-- Wertung überall von selbst, weil sie am Feld `is_captain` hängt.
alter table gameweek_squads add column if not exists is_vice_captain boolean not null default false;
