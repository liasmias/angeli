"use client";

import { useState } from "react";

/**
 * Zeigt einen Wert und lässt die Fläche dahinter kurz aufleuchten, wenn er
 * sich ändert (.wert-blink in globals.css). Beim ersten Anzeigen bleibt es
 * ruhig. Der Zähler dient als key, damit die Animation neu startet.
 */
export default function BlinkZahl({ wert, className = "" }: { wert: string; className?: string }) {
  const [vorher, setVorher] = useState(wert);
  const [wechsel, setWechsel] = useState(0);
  if (vorher !== wert) {
    setVorher(wert);
    setWechsel(wechsel + 1);
  }
  return (
    <span key={wechsel} className={`${wechsel > 0 ? "wert-blink " : ""}${className}`}>
      {wert}
    </span>
  );
}
