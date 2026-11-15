import type { Locale } from "./config";

/** Mirrors the former request-language preference, entirely in the browser. */
export function pickLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.trim().toLowerCase();
    if (/^pt(?:-|$)/.test(tag)) return "pt";
    if (/^en(?:-|$)/.test(tag)) return "en";
  }
  return "en";
}
