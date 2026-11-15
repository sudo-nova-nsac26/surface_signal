import localFont from "next/font/local";

// Checked-in Latin subsets preserve the existing typography without a build-time
// Google request. PT/EN glyphs are included; licensing and provenance are adjacent.
// Atkinson Hyperlegible was designed by the Braille Institute for low vision.
export const atkinson = localFont({
  src: [
    { path: "./fonts/atkinson-hyperlegible-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["Arial"],
});

export const brandFont = localFont({
  src: "./fonts/poppins-latin-700.woff2",
  weight: "700",
  style: "normal",
  variable: "--font-brand",
  display: "swap",
  fallback: ["Arial"],
});
