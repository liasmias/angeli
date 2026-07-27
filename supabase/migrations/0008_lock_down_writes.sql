-- Spielstand-Tabellen für normale Clients schreibgeschützt machen.
--
-- Vorher durfte der Besitzer seine eigenen squad_players / gameweek_squads /
-- transfers / chip_usages direkt schreiben. Damit liess sich die gesamte
-- Server-Validierung (Budget, Formation, Transferkosten, Punkte) umgehen,
-- indem man statt der App direkt die REST-API aufrief — z. B. sich selbst
-- points_earned = 999 setzen oder 15 zu teure Spieler eintragen.
--
-- Ab jetzt schreibt ausschliesslich der Server (Service-Role-Client in den
-- Server-Actions, nach Auth-/Validierungsprüfung). Lesen bleibt für alle
-- erlaubt (die Rangliste und die Kader der Gegner brauchen das).
drop policy if exists "own squad_players write" on squad_players;
drop policy if exists "own gameweek_squads write" on gameweek_squads;
drop policy if exists "own transfers write" on transfers;
drop policy if exists "own chip_usages write" on chip_usages;

-- Kein Ersatz-Write-Policy: ohne passende Policy verweigert RLS jeden
-- Client-Schreibzugriff. Der Service-Role-Client umgeht RLS und schreibt
-- weiterhin.
