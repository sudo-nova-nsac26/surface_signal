import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { LanguageSwitch } from "./LanguageSwitch";

function BrandMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="size-11 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="11" fill="var(--brand)" />
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="none"
        stroke="var(--brand-ink)"
        strokeOpacity="0.35"
      />
      <path
        d="M7 15c4.300-3.700 8.700-3.700 13 0s8.700 3.700 13 0"
        fill="none"
        stroke="var(--flag-yellow)"
        strokeWidth="3.200"
        strokeLinecap="round"
      />
      <path
        d="M7 24.500c4.300-3.700 8.700-3.700 13 0s8.700 3.700 13 0"
        fill="none"
        stroke="var(--brand-ink)"
        strokeWidth="3.200"
        strokeLinecap="round"
      />
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
    <header className="relative bg-surface shadow-sm hc:border-b-2 hc:border-ink">
      <div className="flag-stripe h-2" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-2xl font-bold tracking-tight">
              {dict.brand.name}
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
