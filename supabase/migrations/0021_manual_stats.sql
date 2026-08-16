-- Kennzeichnung für Spieler, deren Statistik von Hand nachgetragen wird.
--
-- API-Football führt nicht jeden Spieler der Liga. Wer dort fehlt, hat keine
-- API-ID und wird vom Sync übergangen — seine Werte trägt der Admin nach
-- Abpfiff ein. Spielbar ist er ganz normal, nur erscheinen die Punkte später
-- als bei allen anderen.
--
-- Bewusst ein Schalter statt eines Freitextfelds: Der erklärende Satz liegt
-- damit im Wörterbuch und existiert auf Deutsch wie Englisch. Ein Freitext
-- wäre zwangsläufig einsprachig.
alter table players add column if not exists manual_stats boolean not null default false;

comment on column players.manual_stats is
  'Statistik wird manuell nachgetragen (kein Eintrag bei API-Football).';

-- D. Mikolajewski (Luzern) — von API-Football nicht geführt.
update players set manual_stats = true where last_name = 'D. Mikolajewski';
