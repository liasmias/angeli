"use client";

import { useEffect, useState } from "react";
import { getDictionary, type Lang } from "@/lib/i18n";

/**
 * „in 6 Tagen“ neben dem Deadline-Datum — der einzige Ort für den Countdown.
 * Erst nach dem Mounten berechnet: `Date.now()` im Render würde beim Hydrieren
 * vom Server-Wert abweichen. Der Platz bleibt bis dahin frei.
 */
export default function Countdown({ deadline, lang }: { deadline: string; lang: Lang }) {
  const t = getDictionary(lang).builder;
  const [stunden, setStunden] = useState<number | null>(null);
  useEffect(() => {
    const rechne = () =>
      setStunden(Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000)));
    rechne();
    const id = setInterval(rechne, 60_000);
    return () => clearInterval(id);
  }, [deadline]);
  if (stunden === null) return null;
  return (
    <span className="whitespace-nowrap font-bold text-brand-magenta">
      {" · "}
      {stunden >= 48 ? t.inDays(Math.round(stunden / 24)) : t.inHours(stunden)}
    </span>
  );
}
