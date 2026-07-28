"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/** Sprachumschalter DE ↔ EN — Cookie setzen und alles neu rendern. */
export async function toggleLang() {
  const store = await cookies();
  const current = store.get("lang")?.value === "en" ? "en" : "de";
  store.set("lang", current === "en" ? "de" : "en", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
