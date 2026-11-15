"use client";

import { useId, useRef, useState } from "react";
import type { ApiLayer, ApiStory } from "@/data/api-types";
import type { ComparisonDetail, TimelineStep } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { CHANGE_COLORS, type ChangeLayers } from "./MapView";

type Labels = Dictionary["map"]["compare"];
type Featured = Dictionary["map"]["featured"];
type MapLayerId = "radar_increase" | "radar_decrease" | "open_water";
type Row = { label: string; value: string; extra?: string | null };

// Water first: it is what people look for after a flood.
const MAP_LAYERS: { id: MapLayerId; key: "increase" | "decrease" | "water" }[] = [
  { id: "open_water", key: "water" },
  { id: "radar_decrease", key: "decrease" },
  { id: "radar_increase", key: "increase" },
];
const SHOWN_ELSEWHERE = new Set(["general_change", ...MAP_LAYERS.map((layer) => layer.id)]);
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
 * The extra information, away from the main panel: the backend's full
 * explanation, the other layers and the exact numbers. One button opens it.
 */
function LearnMore({
  labels,
  lang,
  story,
  others,
  rows,
  params,
  number,
}: {
  labels: Labels;
  lang: Locale;
  story: ApiStory;
  others: ApiLayer[];
  rows: Row[];
  params: Record<string, number> | undefined;
  number: (value: number | null | undefined, digits?: number) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"story" | "layers" | "tech">("story");
  const uid = useId();
  const tabs = [
    { id: "story" as const, name: labels.understand },
    { id: "layers" as const, name: labels.otherLayers },
    { id: "tech" as const, name: labels.technical },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="pressable flex min-h-14 w-full flex-col items-start justify-center rounded-xl border-2 border-line bg-surface px-3 py-2 text-left hover:border-brand hc:border-ink"
      >
        <span className="font-bold">{labels.learnMore}</span>
        <span className="text-xs text-ink-soft">{labels.learnMoreHint}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-title`}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto max-h-[85svh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line bg-bg-raised p-5 text-ink backdrop:bg-black/70 hc:border-2 hc:border-ink"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${uid}-title`} className="text-xl font-bold">
            {story.title}
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} className="tool-button shrink-0">
            {labels.close}
          </button>
        </div>

        <div role="tablist" aria-label={labels.tabs} className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${uid}-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`${uid}-panel`}
              onClick={() => setTab(item.id)}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold ${
                tab === item.id
                  ? "border-brand bg-brand text-brand-ink hc:border-highlight hc:bg-highlight hc:text-highlight-ink"
                  : "border-line bg-surface hover:border-brand hc:border-ink"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${uid}-panel`}
          aria-labelledby={`${uid}-tab-${tab}`}
          className="mt-4 flex flex-col gap-3 text-base"
        >
          {tab === "story" && (
            <>
              <p className="font-bold">{story.summary}</p>
              <p>
                <strong>{labels.observation}: </strong>
                {story.observation}
              </p>
              <p>
                <strong>{labels.interpretation}: </strong>
                {story.interpretation}
                {story.water_interpretation ? ` ${story.water_interpretation}` : ""}
              </p>
              <div>
                <strong>{labels.alternatives}</strong>
                <ul className="list-disc pl-5">
                  {story.alternative_explanations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>{labels.limitations}</strong>
                <ul className="list-disc pl-5">
                  {story.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>{labels.sources}</strong>
                <ul className="list-disc pl-5">
                  {story.sources.map((url) => (
                    <li key={url} className="break-all">
                      <a href={url} target="_blank" rel="noreferrer" className="text-brand-text underline">
                        {url.replace(/^https?:\/\//, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {tab === "layers" && (
            <ul className="flex flex-col gap-3">
              {others.map((layer) => (
                <li key={layer.layer_id}>
                  <span className="font-bold">{layer.name[lang]}</span>
                  {" · "}
                  {labels.status[layer.status as keyof Labels["status"]] ?? layer.status}
                  <span className="block text-sm text-ink-soft">{layer.limitations[lang]}</span>
                </li>
              ))}
            </ul>
          )}

          {tab === "tech" && (
            <>
              <p className="text-sm text-ink-soft">{labels.technicalNote}</p>
              <dl className="flex flex-col gap-1.5">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 border-b border-line pb-1.5">
                    <dt>{row.label}</dt>
                    <dd className="text-right font-bold">
                      {row.value}
                      {row.extra && <span className="block text-xs font-normal text-ink-soft">{row.extra}</span>}
                    </dd>
                  </div>
                ))}
                {params?.threshold_db != null && (
                  <div className="flex justify-between gap-3 border-b border-line pb-1.5">
                    <dt>{labels.threshold}</dt>
                    <dd className="font-bold">± {number(params.threshold_db, 1)} dB</dd>
                  </div>
                )}
                {params?.min_component_pixels != null && (
                  <div className="flex justify-between gap-3 border-b border-line pb-1.5">
                    <dt>{labels.minGroup}</dt>
                    <dd className="font-bold">
                      {number(params.min_component_pixels, 0)} {labels.pixelsUnit}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-sm text-ink-soft">{story.result}</p>
              <p className="text-sm text-ink-soft">{labels.areaNote}</p>
            </>
          )}
        </div>
      </dialog>
    </>
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
}) {
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const number = (value: number | null | undefined, digits = 2) =>
    value == null
      ? labels.unavailable
      : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  // Small areas keep a third decimal so they never read as zero.
  const area = (value: number | null | undefined) =>
    value == null ? labels.unavailable : `${number(value, value < 0.1 ? 3 : 2)} ${labels.unit}`;

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
  const params = detail.stats.general_change?.parameters;
  const layerById = new Map<string, ApiLayer>(detail.layers.map((layer) => [layer.layer_id, layer]));
  const others = detail.layers.filter((layer) => !SHOWN_ELSEWHERE.has(layer.layer_id));
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

  const rows: Row[] = [
    { label: labels.validArea, value: area(g?.valid_area_km2) },
    {
      label: labels.increase,
      value: area(g?.increase_area_km2),
      extra: g?.increase_components == null ? null : fill(labels.groups, { count: number(g.increase_components, 0) }),
    },
    {
      label: labels.decrease,
      value: area(g?.decrease_area_km2),
      extra: g?.decrease_components == null ? null : fill(labels.groups, { count: number(g.decrease_components, 0) }),
    },
    { label: labels.changed, value: area(g?.changed_area_km2) },
    {
      label: labels.water,
      value: area(w?.candidate_area_km2),
      extra: w?.candidate_components == null ? null : fill(labels.groups, { count: number(w.candidate_components, 0) }),
    },
  ];

  return (
    <div className="flex flex-col gap-3" aria-busy={status === "loading"}>
      {/* Plain words first. */}
      <div className="rounded-2xl border border-line bg-surface p-3 hc:border-ink">
        {stop && <h3 className="text-base font-bold text-brand-text">{stop.title}</h3>}
        <div aria-live="polite" className="mt-1 flex flex-col gap-1.5 text-base leading-snug">
          {summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {stop && <p className="mt-2 text-sm text-ink-soft">{stop.body}</p>}
        <p className="mt-2 inline-block rounded-full border border-highlight px-2.5 py-0.5 text-xs font-bold text-highlight">
          {story.synthetic ? labels.synthetic : labels.notValidated}
        </p>
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

      <p className="flex items-center gap-2 text-sm font-bold text-highlight">
        <span aria-hidden="true">☝</span>
        {labels.tapHint}
      </p>

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
                      ? `linear-gradient(135deg, ${CHANGE_COLORS[id]}, ${CHANGE_COLORS[id]}99)`
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

      <LearnMore
        labels={labels}
        lang={lang}
        story={story}
        others={others}
        rows={rows}
        params={params}
        number={number}
      />
    </div>
  );
}
