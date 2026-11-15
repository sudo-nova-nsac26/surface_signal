import type { Metadata } from "next";
import { atkinson, brandFont } from "@/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "SurfaceSignal — Português / English",
  description: "O que o satélite viu. What the satellite saw.",
};

export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${brandFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
