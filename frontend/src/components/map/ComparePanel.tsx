"use client";

import type { ApiLayer, EnvironmentalContextReport } from "@/data/api-types";
import { extractCandidateCrossings, extractDailyRainfallComparison } from "@/data/environmental";
import type { ComparisonDetail, TimelineStep } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { usePreferences } from "@/preferences/store";
import { SpeakButton } from "../ui/SpeakButton";
import { makeFormat } from "./ComparisonInfo";
import { CHANGE_COLORS, COLORBLIND_CHANGE_COLORS, type ChangeLayers } from "./MapView";

type Labels = Dictionary["map"]["compare"];
type Featured = Dictionary["map"]["featured"];
type MapLayerId = "radar_increase" | "radar_decrease" | "open_water";

// Water first: it is what people look for after a flood.
const MAP_LAYERS: { id: MapLayerId; key: "increase" | "decrease" | "water" }[] = [
  { id: "open_water", key: "water" },
  { id: "radar_decrease", key: "decrease" },
  { id: "radar_increase", key: "increase" },
];
/** A football pitch of 105 m × 68 m, to give areas an everyday size. */
const PITCH_KM2 = 0.00714;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function pitches(km2: number) {
  const n = km2 / PITCH_KM2;
  if (n < 20) return Math.max(1, Math.round(n));
  if (n < 100) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

/** A sliding switch that looks pressable; `pulse` blinks it a few times. */
function Switch({ on, pulse }: { on: boolean; pulse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-white/90 p-0.5 ${
        on ? "justify-end bg-white/30" : "justify-start bg-black/30"
      } ${pulse ? "hint-pulse" : ""}`}
    >
      <span className={`size-4 rounded-full ${on ? "bg-white" : "bg-white/70"}`} />
    </span>
  );
}

/**
 * What the chosen comparison shows, plain words first: a short summary built
 * from the backend numbers, then one card per kind of change that you can turn
 * on and off on the map. Everything else waits behind "Learn more". The
 * browser computes no new result: only unit conversions of backend numbers,
 * and null stays "unavailable".
 */
export function ComparePanel({
  labels,
  featured,
  lang,
  step,
  detail,
  status,
  onRetry,
  changes,
  onChanges,
  environmentalReport,
}: {
  labels: Labels;
  featured: Featured;
  lang: Locale;
  step: TimelineStep | null;
  detail: ComparisonDetail | null;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  changes: ChangeLayers;
  onChanges: (next: ChangeLayers) => void;
  environmentalReport?: EnvironmentalContextReport | null;
}) {
  const { number, area } = makeFormat(lang, labels);
  const prefs = usePreferences();
  const activeColors = prefs.colorblind ? COLORBLIND_CHANGE_COLORS : CHANGE_COLORS;

  if (status === "loading" && !detail) {
    return <p className="text-base text-ink-soft">{labels.loading}</p>;
  }
  if (status === "error" || !detail || !step) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-base">{labels.error}</p>
        <button type="button" onClick={onRetry} className="tool-button">
          {labels.retry}
        </button>
      </div>
    );
  }

  const g = detail.stats.general_change?.statistics;
  const w = detail.stats.open_water?.statistics;
  const story = detail.story;
  const layerById = new Map<string, ApiLayer>(detail.layers.map((layer) => [layer.layer_id, layer]));
  const visible = changes.opacity > 0;
  const stop = step.reason ? featured[step.reason] : null;
  const areaOf: Record<MapLayerId, number | null | undefined> = {
    open_water: w?.candidate_area_km2,
    radar_decrease: g?.decrease_area_km2,
    radar_increase: g?.increase_area_km2,
  };

  const changed = g?.changed_area_km2;
  const water = w?.candidate_area_km2;
  const summary: string[] = [];
  if (changed != null && g?.changed_percent != null) {
    summary.push(
      fill(labels.summaryChanged, {
        area: number(changed),
        percent: number(g.changed_percent, 1),
        fields: number(pitches(changed), 0),
      }),
    );
  }
  if (water != null && water > 0 && water < PITCH_KM2) {
    summary.push(fill(labels.summaryWaterTiny, { area: number(water, 3) }));
  } else if (water != null && water > 0) {
    summary.push(fill(labels.summaryWater, { area: number(water), fields: number(pitches(water), 0) }));
  } else if (w?.candidate_components === 0) {
    summary.push(labels.summaryNoWater);
  }
  if (summary.length === 0) summary.push(labels.summaryMissing);

  const rainView = environmentalReport ? extractDailyRainfallComparison(environmentalReport) : null;
  const crossings = environmentalReport ? extractCandidateCrossings(environmentalReport) : null;
  const rain3dAfter = rainView?.windows.find((win) => win.key === "3d")?.afterMm ?? null;
  const rain3dBefore = rainView?.windows.find((win) => win.key === "3d")?.beforeMm ?? null;
  const topMunis = crossings?.municipalitiesInCandidates ?? [];
  const spokenSummary = [
    stop?.title,
    ...summary,
    stop?.body,
    rain3dAfter !== null
      ? `${lang === "pt" ? "Chuva em 3 dias:" : "Rain in 3 days:"} ${number(rain3dAfter, 1)} mm`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="flex flex-col gap-3" aria-busy={status === "loading"}>
      {/* Plain words first. */}
      <div className="rounded-2xl border border-line bg-surface p-3 hc:border-ink">
        <div className="flex items-start justify-between gap-2">
          {stop ? (
            <h3 className="text-base font-bold text-brand-text">{stop.title}</h3>
          ) : (
            <span />
          )}
          <SpeakButton
            text={spokenSummary}
            lang={lang}
            label={lang === "pt" ? "Ouvir" : "Listen"}
          />
        </div>
        <div aria-live="polite" className="mt-1 flex flex-col gap-1.5 text-base leading-snug">
          {summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {stop && <p className="mt-2 text-sm text-ink-soft">{stop.body}</p>}
        {(rain3dAfter !== null || topMunis.length > 0 || crossings?.candidateElevationM !== null) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2 text-xs">
            {rain3dAfter !== null && (
              <span className="rounded-lg border border-line bg-canvas px-2 py-1 text-ink">
                {lang === "pt" ? "Chuva (3 dias):" : "Rain (3d):"}{" "}
                <strong>{number(rain3dAfter, 1)} mm</strong>
                {rain3dBefore !== null ? ` (${lang === "pt" ? "antes:" : "prior:"} ${number(rain3dBefore, 1)} mm)` : ""}
              </span>
            )}
            {topMunis.length > 0 && (
              <span className="rounded-lg border border-line bg-canvas px-2 py-1 text-ink">
                {topMunis
                  .map((m) => `${m.name}${m.sharePercent !== null ? ` ${number(m.sharePercent, 0)}%` : ""}`)
                  .join(" · ")}
              </span>
            )}
            {crossings?.candidateElevationM != null && (
              <span className="rounded-lg border border-line bg-canvas px-2 py-1 text-ink">
                {lang === "pt" ? "Terreno nas manchas:" : "Patch height:"}{" "}
                <strong>~{number(crossings.candidateElevationM, 0)} m</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-bold">{labels.whatToSee}</h4>
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          onClick={() => onChanges({ ...changes, opacity: visible ? 0 : 1 })}
          className="flex min-h-11 items-center gap-2 rounded-full border-2 border-line px-3 text-sm font-bold hover:border-brand hc:border-ink"
        >
          {labels.showChanges}
          <span
            aria-hidden="true"
            className={`flex h-5 w-9 items-center rounded-full border-2 border-ink p-0.5 ${
              visible ? "justify-end bg-brand" : "justify-start bg-surface"
            }`}
          >
            <span className={`size-3 rounded-full ${visible ? "bg-brand-ink" : "bg-ink"}`} />
          </span>
        </button>
      </div>

      <p className="text-sm font-bold text-highlight">{labels.tapHint}</p>

      {/* One card per kind of change; pressing it turns the layer on or off. */}
      <ul className="grid grid-cols-2 gap-2">
        {MAP_LAYERS.map(({ id, key }, i) => {
          const layer = layerById.get(id);
          const usable = Boolean(layer?.available);
          const on = usable && changes[key];
          const card = labels.cards[id];
          return (
            <li key={id} className={i === 0 ? "col-span-2" : ""}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={!usable}
                onClick={() => onChanges({ ...changes, [key]: !changes[key] })}
                className={`pressable flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border-2 text-left disabled:opacity-50 ${
                  on ? "border-brand" : "border-line hover:border-ink-soft"
                } bg-surface hc:border-ink`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 items-center justify-between gap-2 px-3 text-xl font-bold text-white"
                  style={{
                    background: on
                      ? `linear-gradient(135deg, ${activeColors[id]}, ${activeColors[id]}99)`
                      : "var(--line)",
                  }}
                >
                  {labels.symbols[id]}
                  <span className="flex items-center gap-2 text-xs">
                    {on ? labels.on : labels.off}
                    <Switch on={on} pulse={usable} />
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-0.5 p-2.5">
                  <span className="text-lg font-bold leading-tight">{card.title}</span>
                  <span className="text-xs leading-snug text-ink-soft">{card.note}</span>
                  <span className="mt-auto pt-1 text-sm font-bold">{area(areaOf[id])}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-soft">
        {labels.signalNote} {labels.showChangesHint}
      </p>

      {/* The least urgent note comes last. */}
      <p className="rounded-xl border border-line px-3 py-2 text-xs text-ink-soft">
        {story.synthetic ? labels.synthetic : labels.notValidated}
      </p>

    </div>
  );
}
