"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LinkIcon, MessageIcon } from "./icons";

/**
 * WhatsApp share (plain text + link, nothing tracked) and "copy link".
 * The page address is read when pressed, so it works on any host.
 */
export function ShareButtons({
  lang,
  labels,
}: {
  lang: Locale;
  labels: Dictionary["help"];
}) {
  const [copied, setCopied] = useState(false);
  const pageUrl = () => `${window.location.origin}/${lang}`;

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => {
          const text = `${labels.shareText} ${pageUrl()}`;
          window.open(
            `https://wa.me/?text=${encodeURIComponent(text)}`,
            "_blank",
            "noopener",
          );
        }}
        className="pressable inline-flex min-h-14 items-center gap-3 rounded-2xl border-2 border-transparent bg-[#25d366] px-6 text-xl font-bold text-[#04121c] hc:border-ink"
      >
        <MessageIcon />
        {labels.whatsapp}
        <span className="sr-only"> ({labels.newTab})</span>
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(pageUrl());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
        className="pressable inline-flex min-h-14 items-center gap-3 rounded-2xl border-2 border-line bg-surface px-6 text-xl font-bold hover:border-brand hc:border-ink"
      >
        <LinkIcon />
        <span aria-live="polite">{copied ? labels.copied : labels.copy}</span>
      </button>
    </div>
  );
}
