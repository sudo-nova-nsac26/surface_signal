import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { TEAM_SITE_URL } from "@/links";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { TeamIcon } from "./icons";
import { LanguageSwitch } from "./LanguageSwitch";

export function SiteHeader({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  return (
    <header className="relative border-b border-line bg-bg-raised hc:border-b-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* A plain link on purpose: a full page load, as if reloading the site. */}
        <a
          href={`/${lang}`}
          aria-label={`${dict.brand.name} — ${dict.brand.home}`}
          className="flex items-center gap-3 rounded-xl"
        >
          {/* The symbol of the SurfaceSignal logo; the name beside it is text. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/surfacesignal-mark.webp"
            alt=""
            width={52}
            height={49}
            className="h-12 w-auto shrink-0"
          />
          <div className="leading-tight">
            <p className="brand-name text-2xl sm:text-3xl">
              Surface<span className="text-brand-text">Signal</span>
            </p>
            <p className="hidden text-base text-ink-soft sm:block">
              {dict.brand.tagline}
            </p>
          </div>
        </a>
        <div className="flex items-center gap-1">
          {/* The team site opens in a new tab so the map here is not lost. */}
          <a
            href={TEAM_SITE_URL}
            target="_blank"
            rel="noopener"
            className="tool-button"
          >
            <TeamIcon />
            <span className="sr-only sm:not-sr-only">{dict.about.label}</span>
            <span className="sr-only"> ({dict.about.newTab})</span>
          </a>
          <LanguageSwitch current={lang} />
          <AccessibilityMenu labels={dict.a11y} />
        </div>
      </div>
    </header>
  );
}
