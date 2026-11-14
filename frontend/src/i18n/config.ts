export const locales = ["pt", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/** Value for the `lang` attribute, so screen readers pick the right voice. */
export const htmlLang: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
};
