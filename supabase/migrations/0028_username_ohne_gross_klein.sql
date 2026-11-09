-- Accountnamen ohne Gross-/Kleinschreibung eindeutig.
--
-- Bisher galt nur `unique (username)`: „Olympique_Jambon“ und
-- „olympique_jambon“ konnten nebeneinander existieren und sahen in der
-- Rangliste fast gleich aus. iOS schreibt den ersten Buchstaben zudem
-- automatisch gross, so entstand das auch unabsichtlich.
--
-- Vor dem Anlegen geprüft: Am 9.11.2026 gab es keine solchen Dubletten.
-- Signup und changeUsername prüfen vorab mit ilike (src/lib/username.ts).

create unique index if not exists profiles_username_lower_key
  on profiles (lower(username));
