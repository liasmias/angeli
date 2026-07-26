import type { Metadata } from "next";
import { EB_Garamond, Playfair_Display, Space_Grotesk } from "next/font/google";
import Nav from "@/components/nav";
import "./globals.css";

// Space Grotesk trägt die Oberfläche, Playfair Display die grossen Titel.
// EB Garamond steht für längere Fliesstexte bereit.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Angeli — Super League Fantasy",
  description: "Fantasy Football für die Swiss Super League 26/27",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${spaceGrotesk.variable} ${playfair.variable} ${ebGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        {children}
      </body>
    </html>
  );
}
