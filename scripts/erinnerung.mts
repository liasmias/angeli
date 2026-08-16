/**
 * Erinnerung an alle, die zum Ausfuehrungszeitpunkt noch gar kein Team haben.
 *
 *   npx tsx erinnerung.mts          -> Probelauf, verschickt nichts
 *   npx tsx erinnerung.mts --senden -> verschickt wirklich
 *
 * Der Empfaengerkreis wird beim Start frisch aus der Datenbank gelesen, nicht
 * vorher festgelegt: Wer bis dahin ein Team gebaut hat, faellt automatisch raus.
 * Ausgeschlossen sind ausserdem Kader, die zwar leer sind, aber schon eine
 * Aufstellung fuer diese Runde haben (kann es eigentlich nicht geben —
 * Sicherheitsnetz gegen doppelte Mails).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const SENDEN = process.argv.includes("--senden");
const ABSENDER = "Angeli Fantasy <noreply@angeli-fantasy.org>";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// --- Empfaenger bestimmen -------------------------------------------------
const { data: gw3 } = await sb
  .from("gameweeks")
  .select("id, number, deadline, is_locked")
  .eq("number", 3)
  .single();

const offenBis = new Date(gw3!.deadline).getTime();
if (Date.now() >= offenBis || gw3!.is_locked) {
  console.log("Deadline bereits vorbei oder Runde gesperrt — es wird nichts verschickt.");
  process.exit(0);
}

const { data: squads } = await sb.from("squads").select("id, user_id, profiles(username)");
const { data: kader } = await sb.from("squad_players").select("squad_id");
const { data: snaps } = await sb.from("gameweek_squads").select("squad_id").eq("gameweek_id", gw3!.id);

const mitKader = new Set((kader ?? []).map((r) => r.squad_id));
const mitSnapshot = new Set((snaps ?? []).map((r) => r.squad_id));
const name = (s: any) => (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.username ?? "?";

const ohneTeam = (squads ?? []).filter((s) => !mitKader.has(s.id) && !mitSnapshot.has(s.id));

// E-Mail-Adressen aus der Auth-Tabelle nachschlagen
const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
const mailById = new Map(users.users.map((u) => [u.id, u.email]));

const empfaenger = ohneTeam
  .map((s) => ({ name: name(s), mail: mailById.get(s.user_id) }))
  .filter((e): e is { name: string; mail: string } => Boolean(e.mail));

console.log(`Deadline: ${gw3!.deadline}`);
console.log(`Ohne Team: ${ohneTeam.length} | mit gueltiger Adresse: ${empfaenger.length}`);
for (const e of empfaenger) console.log(`  ${e.name.padEnd(24)} ${e.mail}`);

if (!SENDEN) {
  console.log("\nProbelauf — es wurde nichts verschickt. Mit --senden wirklich senden.");
  process.exit(0);
}

// --- Versand --------------------------------------------------------------
const KEY = env.RESEND_API_KEY;
if (!KEY) {
  console.error("RESEND_API_KEY fehlt in .env.local — nichts verschickt.");
  process.exit(1);
}

const text = (n: string) => `Hey ${n}

danke fürs Mitspielen bei Angeli Fantasy! Kleiner Reminder: Du hast noch keine Aufstellung für den heutigen Spieltag festgelegt. Stelle bis um 17:00 auf und sichere das Team mit dem Button «Team speichern».

angeli-fantasy.org

Danke & viel Glück!`;

const html = (n: string) => `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0a2e19">
<p>Hey ${n}</p>
<p>danke fürs Mitspielen bei Angeli Fantasy! Kleiner Reminder: Du hast noch keine Aufstellung für den heutigen Spieltag festgelegt. Stelle bis um <b>17:00</b> auf und sichere das Team mit dem Button «Team speichern».</p>
<p><a href="https://angeli-fantasy.org/team" style="display:inline-block;background:#c21fc2;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:6px">Team aufstellen</a></p>
<p>Danke &amp; viel Glück!</p>
</div>`;

let ok = 0;
for (const e of empfaenger) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: ABSENDER,
      to: [e.mail],
      subject: "Angeli: Aufstellung für heute fehlt noch",
      text: text(e.name),
      html: html(e.name),
    }),
  });
  const j = await res.json();
  if (res.ok) { ok++; console.log(`  gesendet an ${e.name} (${j.id})`); }
  else console.error(`  FEHLER bei ${e.name}: ${JSON.stringify(j)}`);
  await new Promise((r) => setTimeout(r, 600)); // Resend-Ratelimit schonen
}
console.log(`\n${ok} von ${empfaenger.length} Mails verschickt.`);
