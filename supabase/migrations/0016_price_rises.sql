-- Automatische Preiserhöhungen.
--
-- Erreicht ein Spieler an zwei aufeinanderfolgenden Spieltagen ein Rating
-- von mindestens 7.5, steigt sein Preis um 0.3 Mio. Die Tabelle hält je
-- Spieler und Spieltag höchstens einen Eintrag — dadurch ist der Schritt im
-- Sync beliebig wiederholbar, ohne doppelt zu erhöhen.
create table price_changes (
  id bigint generated always as identity primary key,
  player_id bigint not null references players(id) on delete cascade,
  gameweek_id bigint not null references gameweeks(id) on delete cascade,
  delta numeric(4, 1) not null,
  created_at timestamptz not null default now(),
  unique (player_id, gameweek_id)
);

alter table price_changes enable row level security;

-- Für alle lesbar (Preishistorie ist öffentlich); geschrieben wird
-- ausschliesslich serverseitig über den Service-Role-Schlüssel — es gibt
-- bewusst keine Schreib-Policy.
create policy "price_changes_select" on price_changes for select using (true);
