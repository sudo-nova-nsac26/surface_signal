"use client";

import { useState } from "react";
import { htmlLang, type Locale } from "@/i18n/config";

const LABELS: Record<Locale, string> = {
  pt: "Ler em português",
  en: "Read in English",
};

/**
 * A two-position switch: Portuguese on the left, English on the right. The
 * language in use is lit and the other is dimmed. Pressing it slides the
 * thumb across, then loads the other language.
 *
 * It stays a real link (so it works without scripts and can be opened in a
 * new tab); the click is only held back for the length of the slide.
 * Changing language reloads the page so the document language and the
 * pre-paint preferences script are applied cleanly.
 */
export function LanguageSwitch({ current }: { current: Locale }) {
  const target: Locale = current === "pt" ? "en" : "pt";
  // Where the thumb is drawn: it moves as soon as the switch is pressed.
  const [shown, setShown] = useState<Locale>(current);

  return (
    <a
      href={`/${target}`}
      hrefLang={htmlLang[target]}
      lang={htmlLang[target]}
      title={LABELS[target]}
      aria-label={LABELS[target]}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        setShown(target);
        try {
          sessionStorage.setItem("surface_signal_lang_switch", "1");
        } catch {
          // Ignore storage restrictions.
        }
        // A full page load on purpose (see above), so the address is absolute.
        const hash = window.location.hash || "";
        const destination = new URL(`/${target}${hash}`, window.location.origin).href;
        window.setTimeout(() => window.location.assign(destination), 260);
      }}
      className="lang-switch"
      data-position={shown === "pt" ? "left" : "right"}
    >
      <span aria-hidden="true" className="lang-thumb" />
      <span
        aria-hidden="true"
        className="lang-option"
        data-on={shown === "pt"}
        data-lang="pt"
      >
        PT
      </span>
      <span
        aria-hidden="true"
        className="lang-option"
        data-on={shown === "en"}
        data-lang="en"
      >
        EN
      </span>
    </a>
  );
}
