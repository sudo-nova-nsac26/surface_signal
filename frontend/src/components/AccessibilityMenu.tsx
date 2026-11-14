"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  setPreferences,
  usePreferences,
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
  hint,
  stateLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
  stateLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 border-ink bg-surface px-4 py-2 text-left"
    >
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-base text-ink-soft">{hint}</span>
      </span>
      <span
        className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-base font-bold ${
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
        className="pressable flex min-h-12 items-center gap-2 rounded-xl border-2 border-transparent bg-brand px-4 font-bold text-brand-ink hc:border-ink"
      >
        <AccessibilityIcon />
        <span>{labels.open}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        role="group"
        aria-label={labels.title}
        className="absolute inset-x-4 top-full z-20 mt-2 flex flex-col gap-4 rounded-3xl border-2 border-ink bg-surface p-4 shadow-2xl sm:inset-x-auto sm:right-0 sm:w-96"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{labels.title}</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label={labels.close}
            className="flex size-12 items-center justify-center rounded-xl border-2 border-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <div role="radiogroup" aria-label={labels.textSize}>
          <p className="mb-2 font-bold" aria-hidden="true">
            {labels.textSize}
          </p>
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
                  className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-ink px-1 py-2 ${
                    checked ? "bg-ink text-bg" : "bg-surface text-ink"
                  }`}
                >
                  <span className={`${sample} font-bold`} aria-hidden="true">
                    A
                  </span>
                  <span className="text-sm leading-tight">
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
          hint={labels.contrastHint}
          stateLabel={prefs.contrast === "high" ? labels.on : labels.off}
        />

        <Switch
          checked={prefs.motion === "reduce"}
          onChange={(on) => setPreferences({ motion: on ? "reduce" : "auto" })}
          label={labels.motion}
          hint={labels.motionHint}
          stateLabel={prefs.motion === "reduce" ? labels.on : labels.off}
        />
      </div>
    </div>
  );
}
