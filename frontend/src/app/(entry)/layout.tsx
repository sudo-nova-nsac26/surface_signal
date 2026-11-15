import type { Metadata } from "next";
import { atkinson, brandFont } from "@/fonts";
import "../globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://surfacesignal.pages.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SurfaceSignal — O que o satélite viu no Vale do Taquari | What the satellite saw",
  description:
    "Mudanças na superfície medidas pelo satélite radar NISAR (NASA/ISRO) em Lajeado e Estrela (RS), explicadas em palavras simples. Surface change measured by the NISAR radar satellite, explained in plain language.",
  openGraph: {
    title: "SurfaceSignal — NASA/ISRO NISAR Radar in the Taquari Valley",
    description:
      "What the NISAR radar satellite saw during the Taquari River flood in Lajeado and Estrela, explained for everyone.",
    siteName: "SurfaceSignal · Sudo Nova",
    type: "website",
    images: [
      {
        url: "/surfacesignal-logo.webp",
        width: 1200,
        height: 630,
        alt: "SurfaceSignal — Team Sudo Nova",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SurfaceSignal — NASA/ISRO NISAR Radar in the Taquari Valley",
    description:
      "What the NISAR radar satellite saw during the Taquari River flood in Lajeado and Estrela, explained for everyone.",
    images: ["/surfacesignal-logo.webp"],
  },
};

export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${brandFont.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
