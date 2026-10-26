-- Kader speichern in einer einzigen Transaktion.
--
-- saveSquad schrieb bisher nacheinander: Kader löschen, neu einfügen,
-- Gewinne, Transfers, Guthaben, Snapshot. Scheiterte ein Schritt nach dem
-- Löschen, stand der Nutzer ohne Kader da. Und zwei gleichzeitige Saves
-- (Doppelklick, zwei Tabs, Wiederholung bei schlechtem Netz) lasen beide den
-- alten Stand und buchten Transfers und Gewinne doppelt.
--
-- Die Prüfung von Budget, Formation und Transferkosten bleibt in der Server
-- Action. Diese Funktion schreibt nur, und zwar alles oder nichts. Gegen
-- Doppel-Saves sperrt sie die Kaderzeile und vergleicht den Kader, von dem die
-- Action ausging (p_bisher), mit dem aktuellen. Weicht er ab, hat inzwischen
-- ein anderer Save gewonnen — dann bricht sie ab, statt doppelt zu buchen.

create or replace function kader_speichern(
  p_squad_id bigint,
  p_gameweek_id bigint,
  p_bisher bigint[],
  p_spieler jsonb,
  p_realisiert numeric,
  p_transfers jsonb,
  p_gratis_rest int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aktuell bigint[];
begin
  perform 1 from squads where id = p_squad_id for update;
  if not found then
    raise exception 'kader_fehlt';
  end if;

  select coalesce(array_agg(player_id order by player_id), '{}')
    into v_aktuell
    from squad_players where squad_id = p_squad_id;
  if v_aktuell is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(p_bisher) x) then
    raise exception 'kader_veraltet';
  end if;

  delete from squad_players where squad_id = p_squad_id;
  insert into squad_players (squad_id, player_id, is_starting, is_captain, is_vice_captain, purchase_price, bench_order)
  select p_squad_id, (s->>'player_id')::bigint, (s->>'is_starting')::boolean, (s->>'is_captain')::boolean,
         (s->>'is_vice_captain')::boolean, (s->>'purchase_price')::numeric, (s->>'bench_order')::smallint
    from jsonb_array_elements(p_spieler) s;

  insert into transfers (squad_id, gameweek_id, player_out_id, player_in_id, points_cost)
  select p_squad_id, p_gameweek_id, (t->>'player_out_id')::bigint, (t->>'player_in_id')::bigint, (t->>'points_cost')::int
    from jsonb_array_elements(p_transfers) t;

  update squads
     set realised_gains = realised_gains + p_realisiert,
         free_transfers_remaining = p_gratis_rest
   where id = p_squad_id;

  delete from gameweek_squads where squad_id = p_squad_id and gameweek_id = p_gameweek_id;
  insert into gameweek_squads (squad_id, gameweek_id, player_id, is_starting, is_captain, is_vice_captain, bench_order, points_earned)
  select p_squad_id, p_gameweek_id, (s->>'player_id')::bigint, (s->>'is_starting')::boolean, (s->>'is_captain')::boolean,
         (s->>'is_vice_captain')::boolean, (s->>'bench_order')::smallint, null
    from jsonb_array_elements(p_spieler) s;
end;
$$;

-- Nur der Server (Service Role) darf das aufrufen: Die Funktion prüft weder
-- Budget noch Besitz — das tut die Server Action vorher.
revoke execute on function kader_speichern(bigint, bigint, bigint[], jsonb, numeric, jsonb, int) from public, anon, authenticated;
