import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * A bright four-point star over the curve of a planet, echoing the star and
 * the horizon of the Sudo Nova logo.
 */
function BrandMark() {
  return (
    <svg
      viewBox="0 0 44 44"
      className="size-12 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="22"
        cy="22"
        r="20.500"
        fill="var(--bg)"
        stroke="var(--brand)"
        strokeWidth="2"
      />
      <path
        d="M5.500 31.500c8-5.500 25-5.500 33 0"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.600"
        strokeLinecap="round"
      />
      <path
        d="M22 7l2.600 7.400L32 17l-7.400 2.600L22 27l-2.600-7.400L12 17l7.400-2.600z"
        fill="var(--brand)"
      />
      <circle cx="33" cy="9.500" r="1.600" fill="var(--ink)" />
      <circle cx="11" cy="26" r="1.200" fill="var(--ink)" />
    </svg>
  );
}

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
          <BrandMark />
          <div className="leading-tight">
            <p className="text-2xl font-bold tracking-tight">
              Surface<span className="text-brand-text">Signal</span>
            </p>
            <p className="hidden text-base text-ink-soft sm:block">
              {dict.brand.tagline}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitch current={lang} label={dict.language.label} />
          <AccessibilityMenu labels={dict.a11y} />
        </div>
      </div>
    </header>
  );
}
