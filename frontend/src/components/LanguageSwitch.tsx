import { htmlLang, locales, type Locale } from "@/i18n/config";
import { LanguagesIcon } from "./icons";

/** Shown on the button: the language you will switch to. */
const names: Record<Locale, { short: string; action: string }> = {
  pt: { short: "PT", action: "Ler em português" },
  en: { short: "EN", action: "Read in English" },
};

/**
 * One quiet button that shows the other language, like the team site: a
 * translate icon and the code of the language you will get ("EN" while you
 * read Portuguese). It is a plain link on purpose: changing language reloads
 * the page, so the document language and the pre-paint preferences script
 * are applied cleanly.
 */
export function LanguageSwitch({ current }: { current: Locale }) {
  const target = locales.find((locale) => locale !== current) ?? current;
  return (
    <a
      href={`/${target}`}
      hrefLang={htmlLang[target]}
      lang={htmlLang[target]}
      title={names[target].action}
      aria-label={names[target].action}
      className="tool-button"
    >
      <LanguagesIcon width="1.15em" height="1.15em" />
      <span aria-hidden="true">{names[target].short}</span>
    </a>
  );
}
