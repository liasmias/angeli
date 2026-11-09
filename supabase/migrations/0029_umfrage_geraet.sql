-- Umfrage: Wo spielen die Mitglieder Angeli — Handy, Web oder beides?
--
-- Eine Stimme pro Konto (Primärschlüssel user_id). Schreiben und Auswerten
-- laufen nur über den Server (Service-Role) — RLS an, keine Policies.

create table if not exists umfrage_geraet (
  user_id uuid primary key references profiles(id) on delete cascade,
  antwort text not null check (antwort in ('phone', 'web', 'both')),
  created_at timestamptz not null default now()
);

alter table umfrage_geraet enable row level security;
