import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import AuthHashError from "@/components/auth-hash-error";
import Nav from "@/components/nav";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

// Eine einzige Familie für die gesamte App — Abstufung nur über die Stärke.
// Space Grotesk ist variabel von 300 bis 700.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Angeli — Swiss League Fantasy",
  description: "Fantasy Football für die Schweizer Liga, Saison 26/27",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  const t = getDictionary(lang).footer;

  // Admin-Ankündigung — ein Banner auf jeder Seite, solange Text gesetzt ist.
  //
  // Bewusst abgesichert: Das Layout rendert JEDE Antwort, auch die 404-Seite.
  // Wirft die Abfrage — bei einer Störung oder Drosselung von Supabase —,
  // wird aus einem 404 ein 500. Genau das ist am 15.08. passiert, als ein
  // Scanner in fünf Minuten 187 nicht existierende Pfade abgeklappert hat.
  // Ohne Banner weiterzurendern ist allemal besser als eine Fehlerseite.
  let announcement: string | null = null;
  try {
    const supabase = await createClient();
    const { data: settings } = await supabase
      .from("league_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    announcement = settings?.announcement ?? null;
  } catch {
    announcement = null;
  }

  return (
    <html
      lang={lang}
      className={`${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        {announcement && (
          <div className="bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-900">
            📣 {announcement}
          </div>
        )}
        {/* Fehler aus E-Mail-Links kommen als URL-Fragment und können nur
            im Browser ausgewertet werden — daher hier, auf jeder Seite. */}
        <AuthHashError />
        {children}
        <footer className="mt-auto px-4 py-4 text-center text-[11px] leading-relaxed text-brand-deep/45">
          <p>
            {t.disclaimer}{" "}
            <Link href="/impressum" className="font-semibold underline hover:text-brand-magenta">
              {t.imprint}
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
