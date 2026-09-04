-- Antwort der Admins auf eine Meldung.
--
-- Bisher konnte eine Meldung nur als erledigt markiert werden. Wer schrieb,
-- erfuhr nie, was daraus wurde — die Rueckmeldung lief ueber andere Kanaele
-- oder gar nicht. Mit `reply` bekommt jede Meldung einen Antworttext, und
-- das Mitglied sieht ihn dort, wo es die Meldung abgeschickt hat.
--
-- `replied_at` steht getrennt von `resolved_at`: Eine Meldung kann
-- beantwortet und trotzdem offen sein (Rueckfrage), oder erledigt ohne
-- Antwort (offensichtlicher Fall).
alter table reports add column if not exists reply text;
alter table reports add column if not exists replied_at timestamptz;

comment on column reports.reply is 'Antwort der Admins; für das Mitglied im Profil sichtbar.';
