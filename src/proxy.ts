import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// `/passwort-neu` bleibt bewusst offen: Wer über den E-Mail-Link kommt, hat
// zwar eine Sitzung, soll aber auch bei abgelaufenem Link die Seite mit dem
// Hinweis "neuen Link anfordern" sehen statt im Login zu landen.
const PROTECTED_PREFIXES = ["/team", "/admin", "/profil"];

// Runs before every page request: refreshes the Supabase session cookie and
// redirects signed-out users away from protected routes. (Renamed from
// `middleware.ts` in Next.js 16 — same job, new file name.)
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Fällt der Auth-Aufruf aus, läuft der Request weiter statt mit 500 zu
  // enden. Kein Sicherheitsloch: Jede geschützte Seite prüft die Anmeldung
  // selbst noch einmal — der Proxy erspart nur den Umweg über die Seite.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return response;
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
