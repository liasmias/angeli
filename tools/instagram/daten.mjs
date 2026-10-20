// Daten für die Instagram-Posts aus der Datenbank.
//
//   node tools/instagram/daten.mjs top11 <von> <bis>   → ausgabe/top11.json
//   node tools/instagram/daten.mjs preise              → ausgabe/preise.json
//
// Namen wie in der App: Nachname, Initiale nur bei doppelten Nachnamen unter
// aktiven Spielern (siehe src/lib/player-display.ts).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const AUSGABE = path.join(HIER, "ausgabe");
fs.mkdirSync(AUSGABE, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(path.join(HIER, "../../.env.local"), "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const alle = async (t, sel, f) => {
  const o = [];
  for (let v = 0; ; v += 1000) {
    let q = sb.from(t).select(sel).range(v, v + 999);
    if (f) q = f(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    o.push(...data);
    if (data.length < 1000) break;
  }
  return o;
};

// --- Anzeigenamen ---
const PART = new Set(["van","von","de","del","della","di","da","das","dos","du","la","le","ten","ter","bin","al","el","st"]);
const AUSNAHMEN = { "Lee Young-Jun": "Lee" };
const kurz = (f, l) => {
  const v = [f, l].filter(Boolean).join(" ").trim().replace(/\s+/g, " ");
  if (/^\p{Lu}\.\s/u.test(v)) return v;
  const t = v.split(" ");
  if (t.length === 1) return v;
  let i = t.length - 1;
  while (i > 1 && PART.has(t[i - 1].toLowerCase())) i--;
  return `${t[0][0].toUpperCase()}. ${t.slice(i).join(" ")}`;
};
const nach = (f, l) => { const k = kurz(f, l); return k.replace(/^(?:\p{Lu}\.\s*)+/u, "").trim() || k; };
const schluessel = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const spieler = await alle("players", "id,first_name,last_name,position,price,club_id,is_active");
const clubs = new Map((await alle("clubs", "id,short_name")).map((c) => [c.id, c.short_name]));
const zahl = new Map();
for (const p of spieler.filter((p) => p.is_active)) {
  const k = schluessel(nach(p.first_name, p.last_name));
  zahl.set(k, (zahl.get(k) ?? 0) + 1);
}
const anzeige = (p) =>
  AUSNAHMEN[[p.first_name, p.last_name].filter(Boolean).join(" ")] ??
  (p.is_active && (zahl.get(schluessel(nach(p.first_name, p.last_name))) ?? 0) <= 1
    ? nach(p.first_name, p.last_name)
    : kurz(p.first_name, p.last_name));
const proId = new Map(spieler.map((p) => [p.id, p]));

// Bis zur sauberen Grenze: Gleichplatzierte nie willkürlich abschneiden.
const bisGrenze = (liste, min, wert) => {
  const r = liste.slice(0, min);
  while (liste[r.length] && wert(liste[r.length]) === wert(r[r.length - 1])) r.push(liste[r.length]);
  return r;
};

const [, , modus, ...arg] = process.argv;

if (modus === "top11") {
  const von = Number(arg[0]), bis = Number(arg[1] ?? arg[0]);
  const gws = (await sb.from("gameweeks").select("id,number")).data.filter((g) => g.number >= von && g.number <= bis);
  const ids = gws.map((g) => g.id);
  const pkt = new Map();
  for (const p of await alle("fantasy_points", "player_id,points", (q) => q.in("gameweek_id", ids)))
    pkt.set(p.player_id, (pkt.get(p.player_id) ?? 0) + p.points);
  const min = new Map();
  for (const s of await alle("player_stats", "player_id,minutes,goals", (q) => q.in("gameweek_id", ids)))
    min.set(s.player_id, (min.get(s.player_id) ?? 0) + s.minutes);
  const kand = [...pkt].filter(([id]) => (min.get(id) ?? 0) > 0).map(([id, pts]) => {
    const p = proId.get(id);
    return { name: anzeige(p), club: clubs.get(p.club_id), pos: p.position, preis: +p.price, pts };
  });
  const nachPos = (q) => kand.filter((x) => x.pos === q).sort((a, b) => b.pts - a.pts);
  const G = nachPos("GK"), D = nachPos("DEF"), M = nachPos("MID"), F = nachPos("FWD");
  let best = null;
  for (let d = 3; d <= 5; d++) for (let m = 2; m <= 5; m++) {
    const f = 10 - d - m; if (f < 1 || f > 3) continue;
    const elf = [G[0], ...D.slice(0, d), ...M.slice(0, m), ...F.slice(0, f)];
    const sum = elf.reduce((s, x) => s + x.pts, 0);
    if (!best || sum > best.sum) best = { sum, elf, form: `${d}-${m}-${f}` };
  }
  const kicker = von === bis ? `GAMEWEEK ${von}` : `GAMEWEEK ${von}–${bis}`;
  fs.writeFileSync(path.join(AUSGABE, "top11.json"),
    JSON.stringify({ kicker, formation: best.form, gesamt: best.sum, spieler: best.elf }, null, 1));
  console.log(`Top 11 ${kicker}: ${best.form}, ${best.sum} Punkte`);
}

if (modus === "preise") {
  const pc = await alle("price_changes", "player_id,delta");
  const summe = new Map();
  for (const c of pc) summe.set(c.player_id, Math.round(((summe.get(c.player_id) ?? 0) + Number(c.delta)) * 10) / 10);
  const pkt = new Map();
  for (const p of await alle("fantasy_points", "player_id,points")) pkt.set(p.player_id, (pkt.get(p.player_id) ?? 0) + p.points);
  const liste = [...summe].map(([id, d]) => {
    const p = proId.get(id);
    return { name: anzeige(p), club: clubs.get(p.club_id), pos: p.position, jetzt: +p.price,
      start: Math.round((+p.price - d) * 10) / 10, delta: d, pts: pkt.get(id) ?? 0, aktiv: p.is_active };
  }).filter((x) => x.aktiv);
  const auf = liste.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta || b.pts - a.pts);
  const ab = liste.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta || a.pts - b.pts);
  const { data: letzte } = await sb.from("price_changes").select("gameweeks(number)").order("gameweek_id", { ascending: false }).limit(1);
  const bisRunde = letzte?.[0]?.gameweeks?.number ?? null;
  fs.writeFileSync(path.join(AUSGABE, "preise.json"), JSON.stringify({
    bisRunde, buchungen: pc.length, auf: bisGrenze(auf, 6, (x) => x.delta), ab: bisGrenze(ab, 5, (x) => x.delta),
  }, null, 1));
  console.log(`Preise bis Runde ${bisRunde}: ${pc.length} Änderungen`);
}
