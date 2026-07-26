-- Ungenutzte Gratis-Transfers sammeln sich an (wie bei FPL), aber nur bis zu
-- einer Obergrenze — sonst könnte jemand die halbe Saison sparen und dann
-- den kompletten Kader gratis austauschen.
alter table league_settings
  add column if not exists max_banked_transfers int not null default 5;
