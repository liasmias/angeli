import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest.
 *
 * Ohne Manifest öffnete Angeli vom Home-Bildschirm aus als gewöhnlicher
 * Safari-Tab mit Adressleiste. Mit `display: standalone` startet sie in einem
 * eigenen Fenster wie eine installierte App.
 *
 * Start auf /team: Wer Angeli vom Home-Bildschirm öffnet, will fast immer an
 * seine Aufstellung — nicht auf die Startseite, die sich an Neue richtet.
 * Ohne Anmeldung leitet /team ohnehin zum Login weiter.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Angeli — Swiss League Fantasy",
    short_name: "Angeli",
    description: "Fantasy Football für die Schweizer Liga",
    start_url: "/team",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Farbe der Startfläche, bevor die erste Seite steht — dieselbe wie die
    // Navigationsleiste, damit kein heller Blitz entsteht.
    background_color: "#0a2e19",
    theme_color: "#0a2e19",
    lang: "de-CH",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
