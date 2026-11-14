import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/pt";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  pt: () => import("./dictionaries/pt").then((module) => module.default),
  en: () => import("./dictionaries/en").then((module) => module.default),
};

export const getDictionary = (locale: Locale): Promise<Dictionary> =>
  loaders[locale]();

export type { Dictionary };
