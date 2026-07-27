"use client";

import Script from "next/script";

/**
 * Cloudflare-Turnstile-Widget (Bot-Schutz für Registrierung und Login).
 *
 * Rendert nur, wenn NEXT_PUBLIC_TURNSTILE_SITE_KEY gesetzt ist — solange der
 * Key fehlt, ist der Bot-Schutz inaktiv und die Formulare funktionieren
 * unverändert. Das Widget fügt dem umgebenden <form> automatisch ein
 * verstecktes Feld `cf-turnstile-response` mit dem Token hinzu, das die
 * Server-Action ausliest und an Supabase weitergibt.
 *
 * Zum Aktivieren: Key hier setzen UND in Supabase (Auth → Bot & Abuse
 * Protection) CAPTCHA mit dem passenden Secret einschalten. Beides gehört
 * zusammen.
 */
export default function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        strategy="afterInteractive"
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="light"
        data-refresh-expired="auto"
      />
    </>
  );
}
