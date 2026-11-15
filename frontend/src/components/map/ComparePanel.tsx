"use client";

import { useEffect, useRef } from "react";
import { HillIcon, PlantIcon, WaterIcon } from "@/components/icons";
import type { LayerId, LayerStatus } from "@/data/region";
import type { TimelineStep } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Labels = Dictionary["map"]["compare"];
type LayerLabels = Dictionary["layers"];

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

const LAYERS: { id: LayerId; status: LayerStatus }[] = [
  { id: "water", status: "available" },
  { id: "vegetation", status: "exploratory" },
  { id: "slopes", status: "unavailable" },
];

const ICONS = {
  water: <WaterIcon className="size-6" />,
  vegetation: <PlantIcon className="size-6" />,
  slopes: <HillIcon className="size-6" />,
};

const COLOR_CLASS: Record<LayerId, string> = {
  water: "text-water",
  vegetation: "text-vegetation",
  slopes: "text-slopes",
};

/**
 * Before and after, plus the layers that can be shown.
 *
 * The slider fades the change shapes of the chosen comparison in: at "before"
 * the map is as it was, at "after" it shows what appeared. Only the water
 * layer has data today (the backend's change candidates); vegetation and
 * slopes are listed with their honest status, so the panel does not change
 * when their data exists.
 */
export function ComparePanel({
  labels,
  layers,
  lang,
  step,
  shapeCount,
  value,
  onValue,
  waterOn,
  onWaterOn,
}: {
  labels: Labels;
  layers: LayerLabels;
  lang: Locale;
  step: TimelineStep | null;
  /** Number of change shapes in the chosen comparison; null while unknown. */
  shapeCount: number | null;
  /** 0 = before, 1 = after. */
  value: number;
  onValue: (next: number) => void;
  waterOn: boolean;
  onWaterOn: (next: boolean) => void;
}) {
  const frame = useRef(0);
  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  const date = (iso: string) => dateFormat.format(new Date(iso));

  const hasShapes = Boolean(step?.analysis?.hasChangeShapes) && (shapeCount ?? 0) > 0;
  const note = !step?.analysis
    ? labels.notPrepared
    : shapeCount === 0
      ? labels.noShapes
      : null;

  const state =
    value <= 0.05
      ? labels.stateBefore
      : value >= 0.95
        ? labels.stateAfter
        : labels.stateBetween;

  // The buttons glide to the end; the slider is direct.
  const glideTo = (target: number) => {
    window.cancelAnimationFrame(frame.current);
    const from = value;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 450);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      onValue(from + (target - from) * eased);
      if (t < 1) frame.current = window.requestAnimationFrame(step);
    };
    frame.current = window.requestAnimationFrame(step);
  };

  const buttonClass =
    "pressable min-h-12 flex-1 rounded-xl border-2 px-3 text-lg font-bold";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-bold">{labels.title}</h3>
        {step && (
          <p className="text-sm text-ink-soft">
            {labels.before}: {date(step.beforeAt)} · {labels.after}:{" "}
            {date(step.afterAt)}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => glideTo(0)}
          aria-pressed={value <= 0.05}
          disabled={!hasShapes}
          className={`${buttonClass} ${
            value <= 0.05
              ? "border-brand bg-brand text-brand-ink"
              : "border-line bg-surface hc:border-ink"
          } disabled:opacity-40`}
        >
          {labels.before}
        </button>
        <button
          type="button"
          onClick={() => glideTo(1)}
          aria-pressed={value >= 0.95}
          disabled={!hasShapes}
          className={`${buttonClass} ${
            value >= 0.95
              ? "border-brand bg-brand text-brand-ink"
              : "border-line bg-surface hc:border-ink"
          } disabled:opacity-40`}
        >
          {labels.after}
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(event) => {
          window.cancelAnimationFrame(frame.current);
          onValue(Number(event.target.value) / 100);
        }}
        disabled={!hasShapes}
        aria-label={labels.slider}
        aria-valuetext={state}
        className="timeline-range w-full disabled:opacity-40"
      />
      <p aria-live="polite" className="text-sm font-bold">
        {fill(labels.showing, { state })}
      </p>

      {note ? (
        <p className="rounded-xl border-l-4 border-highlight bg-bg-raised px-3 py-2 text-sm text-ink-soft">
          {note}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            aria-hidden="true"
            className="size-3 rounded-full bg-water"
          />
          {labels.legendWater}
        </p>
      )}

      <div className="border-t border-line pt-3">
        <h4 className="mb-2 text-base font-bold">{labels.layersTitle}</h4>
        <ul className="flex flex-col gap-2">
          {LAYERS.map(({ id, status }) => {
            const interactive = id === "water";
            const on = interactive && waterOn;
            return (
              <li key={id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-disabled={!interactive}
                  onClick={() => {
                    if (interactive) onWaterOn(!waterOn);
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${
                    on ? "border-brand bg-brand-soft" : "border-line bg-surface"
                  } ${interactive ? "" : "opacity-70"} hc:border-ink`}
                >
                  <span className={COLOR_CLASS[id]}>{ICONS[id]}</span>
                  <span className="flex-1">
                    <span className="block font-bold leading-tight">
                      {layers[id].name}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {interactive
                        ? on
                          ? labels.switchOn
                          : labels.switchOff
                        : `${layers.status[status]} · ${labels.locked}`}
                    </span>
                  </span>
                  {interactive && (
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink p-0.5 ${
                        on ? "justify-end bg-brand" : "justify-start bg-surface"
                      }`}
                    >
                      <span
                        className={`size-5 rounded-full ${on ? "bg-brand-ink" : "bg-ink"}`}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
