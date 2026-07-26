import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import Nav from "@/components/nav";
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
      className={`${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        {children}
      </body>
    </html>
  );
}
