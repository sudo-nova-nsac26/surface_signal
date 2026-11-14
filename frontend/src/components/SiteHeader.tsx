import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { AccessibilityMenu } from "./AccessibilityMenu";
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
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitch current={lang} />
          <AccessibilityMenu labels={dict.a11y} />
        </div>
      </div>
    </header>
  );
}
