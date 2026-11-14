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
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="11"
        fill="var(--bg-raised)"
        stroke="var(--brand)"
        strokeWidth="2"
      />
      <path
        d="M8 15.500c4-3.500 8-3.500 12 0s8 3.500 12 0"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="3.200"
        strokeLinecap="round"
      />
      <path
        d="M8 25c4-3.500 8-3.500 12 0s8 3.500 12 0"
        fill="none"
        stroke="var(--ink)"
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
