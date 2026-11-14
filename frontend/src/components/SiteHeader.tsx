import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { LanguageSwitch } from "./LanguageSwitch";

function BrandMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="size-10 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="10" fill="var(--ink)" />
      <path
        d="M6 16c4.700-4 9.300-4 14 0s9.300 4 14 0"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M6 25c4.700-4 9.300-4 14 0s9.300 4 14 0"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
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
    <header className="relative border-b-2 border-ink bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-xl font-bold">{dict.brand.name}</p>
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
