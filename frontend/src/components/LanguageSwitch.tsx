import { htmlLang, locales, type Locale } from "@/i18n/config";

const names: Record<Locale, { short: string; full: string }> = {
  pt: { short: "PT", full: "Português" },
  en: { short: "EN", full: "English" },
};

/**
 * Language names are shown in their own language on purpose, so a visitor who
 * landed on the wrong one can still recognise theirs.
 *
 * These are plain links on purpose: changing language reloads the page, so the
 * document language and the pre-paint preferences script are applied cleanly.
 */
export function LanguageSwitch({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex overflow-hidden rounded-xl border-2 border-ink">
        {locales.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <a
                href={`/${locale}`}
                hrefLang={htmlLang[locale]}
                lang={htmlLang[locale]}
                aria-current={active ? "true" : undefined}
                className={`flex min-h-12 min-w-14 items-center justify-center px-3 font-bold ${
                  active ? "bg-ink text-surface" : "bg-surface text-ink underline"
                }`}
              >
                <span aria-hidden="true">{names[locale].short}</span>
                <span className="sr-only">{names[locale].full}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
