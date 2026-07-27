import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landepunkt für Links aus Supabase-E-Mails (z. B. Passwort zurücksetzen).
 *
 * Supabase hängt einen einmaligen `code` an. Der wird hier serverseitig gegen
 * eine Sitzung getauscht — nur so landen die Auth-Cookies zuverlässig im
 * Browser. Danach geht es weiter zum eigentlichen Ziel.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/team";

  // Nur app-interne Ziele zulassen, damit der Link nicht auf fremde
  // Seiten umgeleitet werden kann.
  const ziel = next.startsWith("/") && !next.startsWith("//") ? next : "/team";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?fehler=link-ungueltig`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/passwort-vergessen?fehler=abgelaufen`);
  }

  return NextResponse.redirect(`${origin}${ziel}`);
}
