import "server-only";
import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";

/** Aktive Sprache aus dem Cookie — Deutsch ist der Standard. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get("lang")?.value === "en" ? "en" : "de";
}
