-- Von Hand terminierte Partien.
--
-- Die SFL verschiebt Ligapartien von Clubs, die in den Playoffs der
-- UEFA-Wettbewerbe stehen — nach Reglement zwischen die beiden Playoff-Spiele.
-- Der neue Termin wird oft erst Wochen später kommuniziert, und API-Football
-- führt die Partie in der Zwischenzeit unverändert im alten Datum und in der
-- alten Runde. Der Sync schriebe eine Korrektur von Hand also binnen Stunden
-- wieder zurück.
--
-- `manual_schedule` markiert genau diese Partien: Runde und Anstosszeit
-- stammen dann von uns, nicht von der API. Der Sync holt weiterhin Status,
-- Resultat und Spielerstatistiken, rührt aber `gameweek_id` und `kickoff`
-- nicht mehr an.
--
-- `gameweek_id` ist bewusst nullable (seit 0001) — eine Partie ohne Termin
-- hängt an keiner Runde. Das ist mehr als Kosmetik: sämtliche Prüfungen auf
-- "alle Partien der Runde beendet" — automatische Einwechslungen, Preis-
-- anpassungen, Rangliste, Live-Anzeige — zählen die Partien der Runde. Bliebe
-- die verschobene Partie darin hängen, wäre die Runde bis zum Nachtragsspiel
-- nie abgeschlossen und die Einwechslungen liefen wochenlang nicht.
alter table fixtures add column if not exists manual_schedule boolean not null default false;

comment on column fixtures.manual_schedule is
  'Runde und Anstosszeit werden von Hand gepflegt; der Sync überschreibt sie nicht.';

-- 4. Runde 2026/27: Thun – Servette, Lugano – St. Gallen und GC – Sion
-- verschoben (SFL, 14.08.2026). Neue Termine noch offen.
update fixtures f
set gameweek_id = null,
    manual_schedule = true,
    status = 'PST'
from gameweeks g, clubs h, clubs a
where f.gameweek_id = g.id
  and g.number = 4
  and h.id = f.home_club_id
  and a.id = f.away_club_id
  and (h.short_name, a.short_name) in (('THU', 'SFC'), ('LUG', 'SG'), ('GC', 'SIO'));
