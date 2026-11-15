"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  setPreferences,
  usePreferences,
  useReducedMotion,
  type TextSize,
} from "@/preferences/store";
import { AccessibilityIcon, CloseIcon } from "./icons";

const TEXT_SIZES: { value: TextSize; sample: string }[] = [
  { value: "md", sample: "text-base" },
  { value: "lg", sample: "text-xl" },
  { value: "xl", sample: "text-2xl" },
];

function Switch({
  checked,
  onChange,
  label,
  badge,
  hint,
  stateLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  badge: string;
  hint: string;
  stateLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full shrink-0 items-center justify-between gap-3 rounded-xl border-2 border-ink bg-surface px-3.5 py-2.5 text-left transition hover:border-brand"
    >
      <span className="min-w-0 flex-1">
        <span className="inline-block rounded-md border border-brand/50 bg-brand/10 px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-brand-text hc:border-ink hc:text-ink">
          {badge}
        </span>
        <span className="mt-1 block font-bold leading-snug">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{hint}</span>
      </span>
      <span
        className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${
          checked ? "bg-ink text-bg" : "bg-surface text-ink"
        }`}
      >
        {stateLabel}
      </span>
    </button>
  );
}

export function AccessibilityMenu({ labels }: { labels: Dictionary["a11y"] }) {
  const [open, setOpen] = useState(false);
  const prefs = usePreferences();
  const reducedMotion = useReducedMotion();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="sm:relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        aria-label={labels.open}
        title={labels.open}
        className="tool-button"
      >
        <AccessibilityIcon width="1.3em" height="1.3em" />
        <span className="hidden sm:inline">{labels.open}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        role="group"
        aria-label={labels.title}
        className="absolute inset-x-4 top-full z-30 mt-2 flex max-h-[calc(100svh-5.5rem)] flex-col gap-2.5 overflow-y-auto rounded-3xl border-2 border-ink bg-surface p-4 shadow-2xl sm:inset-x-auto sm:right-0 sm:w-[26rem]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold leading-tight">{labels.title}</h2>
            <p className="mt-0.5 text-xs leading-snug text-ink-soft">{labels.lead}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label={labels.close}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <div role="radiogroup" aria-label={labels.textSize} className="shrink-0 rounded-xl border border-line bg-bg/50 p-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2" aria-hidden="true">
            <span className="font-bold text-sm">{labels.textSize}</span>
            <span className="rounded-md border border-brand/50 bg-brand/10 px-2 py-0.5 text-[0.7rem] font-bold text-brand-text hc:border-ink hc:text-ink">
              {labels.textSizeBadge}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_SIZES.map(({ value, sample }) => {
              const checked = prefs.textSize === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setPreferences({ textSize: value })}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-ink px-1 py-1.5 ${
                    checked ? "bg-ink text-bg" : "bg-surface text-ink"
                  }`}
                >
                  <span className={`${sample} font-bold leading-none`} aria-hidden="true">
                    A
                  </span>
                  <span className="text-xs leading-tight">
                    {labels.textSizes[value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Switch
          checked={prefs.contrast === "high"}
          onChange={(on) =>
            setPreferences({ contrast: on ? "high" : "default" })
          }
          label={labels.contrast}
          badge={labels.contrastBadge}
          hint={labels.contrastHint}
          stateLabel={prefs.contrast === "high" ? labels.on : labels.off}
        />

        <Switch
          checked={Boolean(prefs.colorblind)}
          onChange={(on) => setPreferences({ colorblind: on })}
          label={labels.colorblind}
          badge={labels.colorblindBadge}
          hint={labels.colorblindHint}
          stateLabel={prefs.colorblind ? labels.on : labels.off}
        />

        <Switch
          checked={Boolean(prefs.readingSpacing)}
          onChange={(on) => setPreferences({ readingSpacing: on })}
          label={labels.readingSpacing}
          badge={labels.readingSpacingBadge}
          hint={labels.readingSpacingHint}
          stateLabel={prefs.readingSpacing ? labels.on : labels.off}
        />

        <Switch
          checked={Boolean(prefs.speechSlow)}
          onChange={(on) => setPreferences({ speechSlow: on })}
          label={labels.speechSlow}
          badge={labels.speechSlowBadge}
          hint={labels.speechSlowHint}
          stateLabel={prefs.speechSlow ? labels.on : labels.off}
        />

        <Switch
          checked={reducedMotion}
          onChange={(on) => setPreferences({ motion: on ? "reduce" : "full" })}
          label={labels.motion}
          badge={labels.motionBadge}
          hint={labels.motionHint}
          stateLabel={reducedMotion ? labels.on : labels.off}
        />

        <div className="shrink-0 rounded-xl border border-brand/40 bg-bg/80 px-3 py-2 text-xs leading-snug text-ink-soft">
          {labels.deafNote}
        </div>
      </div>
    </div>
  );
}
