-- Verfügbarkeits-Markierung für Spieler (wie die Flags in FPL).
--
-- gelb = kurzfristig fraglich (verletzt, gesperrt, angeschlagen)
-- rot  = fällt aus (Vereinswechsel, Langzeitverletzung, Saison-Aus)
--
-- Die Markierung ist reine Information für die Aufstellung — sie
-- verhindert weder das Aufstellen noch die Punktevergabe. Ein Spieler mit
-- roter Markierung bleibt aufstellbar, bringt aber voraussichtlich nichts.
alter table players add column if not exists flag text;
alter table players add column if not exists flag_note text;

alter table players drop constraint if exists players_flag_check;
alter table players add constraint players_flag_check
  check (flag is null or flag in ('yellow', 'red'));

comment on column players.flag is 'null | yellow (fraglich) | red (faellt aus)';
comment on column players.flag_note is 'Kurzer Grund, erscheint als Tooltip.';
