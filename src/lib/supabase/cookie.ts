// Sitzungs-Cookie nur für den Server: Kein Client-Code liest es, also muss es
// auch kein Skript lesen können. 30 Tage statt der Bibliotheks-Vorgabe 400.
export const SITZUNGS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;
