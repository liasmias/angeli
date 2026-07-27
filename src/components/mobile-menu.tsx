"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth-actions";

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Burger-Menü für schmale Bildschirme.
 *
 * Ab `sm` unsichtbar — dort steht die vollständige Navigation nebeneinander.
 * Das Menü schliesst sich bei jedem Seitenwechsel selbst, sonst bliebe es
 * nach einem Klick offen über der neuen Seite liegen.
 */
export default function MobileMenu({
  links,
  username,
}: {
  links: NavLink[];
  username: string | null;
}) {
  const [offen, setOffen] = useState(false);
  const pfad = usePathname();

  useEffect(() => setOffen(false), [pfad]);

  // Hintergrund nicht mitscrollen lassen, solange das Menü offen ist.
  useEffect(() => {
    document.body.style.overflow = offen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [offen]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-label={offen ? "Menü schliessen" : "Menü öffnen"}
        className="pressable flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"
      >
        {/* Drei Striche, die sich beim Öffnen zum Kreuz drehen. */}
        <span className="relative block h-4 w-6" aria-hidden>
          <span
            className={`absolute left-0 block h-0.5 w-6 bg-white transition-all duration-200 ${
              offen ? "top-[7px] rotate-45" : "top-0"
            }`}
          />
          <span
            className={`absolute left-0 top-[7px] block h-0.5 w-6 bg-white transition-opacity duration-200 ${
              offen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-6 bg-white transition-all duration-200 ${
              offen ? "top-[7px] -rotate-45" : "top-[14px]"
            }`}
          />
        </span>
      </button>

      {offen && (
        <>
          {/*
            Overlay und Panel beginnen mit `top-full` unterhalb der Leiste —
            sonst läge der Abdunkler auch über Logo und Burger-Knopf.
          */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOffen(false)}
            className="absolute inset-x-0 top-full z-40 h-screen cursor-default bg-black/40"
          />
          <div className="absolute inset-x-0 top-full z-50 max-h-[80vh] overflow-y-auto border-t border-white/15 bg-brand-deep px-4 py-3 shadow-xl">
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`block rounded-lg px-3 py-3 text-base font-semibold transition-colors ${
                      pfad === l.href
                        ? "bg-white/10 text-brand-accent"
                        : "text-white hover:bg-white/5"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-3 border-t border-white/15 pt-3">
              {username ? (
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href="/profil"
                    className="min-w-0 flex-1 truncate rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    {username}
                  </Link>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="pressable rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Logout
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/login"
                    className="flex-1 rounded-lg border border-white/30 px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="pressable flex-1 rounded-lg bg-brand-accent px-4 py-2.5 text-center text-sm font-bold text-brand-deep"
                  >
                    Registrieren
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
