-- Bank-Reihenfolge und automatische Einwechslungen.
--
-- bench_order bestimmt, wer zuerst nachrückt: 0 = Torhüter (fix auf Platz 1),
-- 1..3 = die Feldspieler in der vom Mitglied gewählten Reihenfolge.
--
-- auto_subbed markiert Zeilen, die nach Spielende automatisch getauscht
-- wurden — sowohl den herausgenommenen als auch den eingewechselten Spieler.
-- Dient der Anzeige und macht den Vorgang wiederholbar: Kader mit gesetzter
-- Markierung überspringt der Sync beim nächsten Lauf.
alter table squad_players add column if not exists bench_order smallint not null default 0;
alter table gameweek_squads add column if not exists bench_order smallint not null default 0;
alter table gameweek_squads add column if not exists auto_subbed boolean not null default false;
