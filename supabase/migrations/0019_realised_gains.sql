-- Realisierte Kursgewinne je Kader.
--
-- Bisher rechnete das Budget ausschliesslich mit aktuellen Preisen:
--   verfügbar = max(100, Kaderwert) − Kaderwert
-- Damit fraß der Preisanstieg eines gehaltenen Spielers das freie Budget auf,
-- während eine Preissenkung fälschlich Geld gutschrieb. Ein Kursgewinn liess
-- sich nie realisieren — er verfiel, sobald der Kaderwert wieder unter den
-- erhöhten Stand sank.
--
-- Neu gilt: Ausgegeben wird zum Einkaufspreis, verkauft zum Tagespreis, und
-- die Differenz landet dauerhaft hier.
--   verfügbar = budget_cap + realised_gains − Summe der Einkaufspreise
alter table squads add column if not exists realised_gains numeric not null default 0;

comment on column squads.realised_gains is
  'Summe aller beim Verkauf realisierten Kursgewinne und -verluste.';

-- Bestandsschutz: Wer durch die Umstellung Budget verlöre, aber in der
-- offenen Runde bereits transferiert hat, behält seinen bisherigen Stand.
-- Betrifft genau einen Kader (Zitonovic, Differenz 0.3).
update squads s
set realised_gains = 0.3
from profiles p
where p.id = s.user_id and p.username = 'Zitonovic';
