-- Meldungen der Mitglieder an die Admins (falsche Punkte, Späteinsteiger-
-- Gutschrift, sonstige Anliegen). Geschrieben und gelesen wird ausschliesslich
-- über die Service-Role — RLS ohne Policies sperrt normale Clients komplett,
-- wie bei den Spielstand-Tabellen.
create table if not exists reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table reports enable row level security;
