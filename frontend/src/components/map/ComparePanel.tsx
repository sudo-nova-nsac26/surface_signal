"use client";

import type { ApiLayer } from "@/data/api-types";
import type { ComparisonDetail, TimelineStep } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { CHANGE_COLORS, type ChangeLayers } from "./MapView";

type Labels = Dictionary["map"]["compare"];
type MapLayerId = "radar_increase" | "radar_decrease" | "open_water";

const MAP_LAYERS: { id: MapLayerId; key: "increase" | "decrease" | "water" }[] = [
  { id: "radar_increase", key: "increase" },
  { id: "radar_decrease", key: "decrease" },
  { id: "open_water", key: "water" },
];
const SHOWN_ELSEWHERE = new Set(["general_change", ...MAP_LAYERS.map((layer) => layer.id)]);

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      aria-hidden="true"
      title={label}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink p-0.5 ${
        on ? "justify-end bg-brand" : "justify-start bg-surface"
      }`}
    >
      <span className={`size-5 rounded-full ${on ? "bg-brand-ink" : "bg-ink"}`} />
    </span>
  );
}

/**
 * What the chosen comparison shows. "Show the changes" only turns the patches
 * on the map on or off: the background map is current, not the earlier date.
 * Layers, numbers and the explanation come from the backend as they are; the
 * browser computes nothing and null stays "unavailable".
 */
export function ComparePanel({
  labels,
  lang,
  step,
  detail,
  status,
  onRetry,
  changes,
  onChanges,
}: {
  labels: Labels;
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
  const area = (value: number | null | undefined) =>
    value == null ? labels.unavailable : `${number(value)} ${labels.unit}`;
  const groups = (value: number | null | undefined) =>
    value == null ? null : fill(labels.groups, { count: number(value, 0) });

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
  const others = detail.layers.filter((layer) => !SHOWN_ELSEWHERE.has(layer.layer_id));
  const visible = changes.opacity > 0;

  const rows: { label: string; value: string; extra?: string | null; color?: string; symbol?: string }[] = [
    { label: labels.validArea, value: area(g?.valid_area_km2) },
    {
      label: labels.increase,
      value: area(g?.increase_area_km2),
      extra: groups(g?.increase_components),
      color: CHANGE_COLORS.radar_increase,
      symbol: labels.symbols.radar_increase,
    },
    {
      label: labels.decrease,
      value: area(g?.decrease_area_km2),
      extra: groups(g?.decrease_components),
      color: CHANGE_COLORS.radar_decrease,
      symbol: labels.symbols.radar_decrease,
    },
    { label: labels.changed, value: area(g?.changed_area_km2) },
    {
      label: labels.water,
      value: area(w?.candidate_area_km2),
      extra: groups(w?.candidate_components),
      color: CHANGE_COLORS.open_water,
      symbol: labels.symbols.open_water,
    },
  ];

  return (
    <div className="flex flex-col gap-4" aria-busy={status === "loading"}>
      <div>
        <h3 className="text-lg font-bold">{labels.title}</h3>
        <p className="mt-1 inline-block rounded-full border border-highlight px-3 py-0.5 text-sm font-bold text-highlight">
          {story.synthetic ? labels.synthetic : labels.notValidated}
        </p>
      </div>

      {/* Show or hide the patches: this is not a picture of the earlier date. */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          onClick={() => onChanges({ ...changes, opacity: visible ? 0 : 1 })}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-line bg-surface px-3 py-2 text-left font-bold hc:border-ink"
        >
          {labels.showChanges}
          <Switch on={visible} label={visible ? labels.on : labels.off} />
        </button>
        <p className="text-sm text-ink-soft">{labels.showChangesHint}</p>
        {visible && (
          <label className="flex items-center gap-3 text-sm font-bold">
            {labels.intensity}
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(changes.opacity * 100)}
              onChange={(event) =>
                onChanges({ ...changes, opacity: Number(event.target.value) / 100 })
              }
              className="timeline-range min-w-0 flex-1"
            />
          </label>
        )}
      </div>

      {/* The three layers the map can draw, as the backend lists them. */}
      <div>
        <h4 className="mb-2 text-base font-bold">{labels.layersTitle}</h4>
        <ul className="flex flex-col gap-2">
          {MAP_LAYERS.map(({ id, key }) => {
            const layer = layerById.get(id);
            const usable = Boolean(layer?.available);
            const on = usable && changes[key];
            return (
              <li key={id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={!usable}
                  onClick={() => onChanges({ ...changes, [key]: !changes[key] })}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left disabled:opacity-50 ${
                    on ? "border-brand bg-brand-soft" : "border-line bg-surface"
                  } hc:border-ink`}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                    style={{ background: CHANGE_COLORS[id] }}
                  >
                    {labels.symbols[id]}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold leading-tight">
                      {layer?.name[lang] ?? id}
                    </span>
                    <span className="block text-sm text-ink-soft">{labels.hints[id]}</span>
                  </span>
                  <Switch on={on} label={on ? labels.on : labels.off} />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-ink-soft">{labels.signalNote}</p>
      </div>

      {/* Numbers exactly as the backend measured them. */}
      <div>
        <h4 className="mb-2 text-base font-bold">{labels.numbersTitle}</h4>
        <dl className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 border-b border-line pb-1.5">
              <dt className="flex items-center gap-2 text-sm">
                {row.color && (
                  <span
                    aria-hidden="true"
                    className="flex size-5 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ background: row.color }}
                  >
                    {row.symbol}
                  </span>
                )}
                {row.label}
              </dt>
              <dd className="text-right text-sm font-bold">
                {row.value}
                {row.extra && <span className="block text-xs font-normal text-ink-soft">{row.extra}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {w?.candidate_components === 0 && <p className="mt-2 text-sm">{labels.noWater}</p>}
        <p className="mt-2 text-sm text-ink-soft">{labels.areaNote}</p>
      </div>

      {/* The backend's explanation, in the chosen language. */}
      <div>
        <h4 className="text-base font-bold">{story.title}</h4>
        <p className="mt-1 text-base">{story.summary}</p>
        <details className="mt-2 rounded-xl border border-line bg-surface px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 font-bold text-brand-text">
            {labels.storyMore}
          </summary>
          <div className="flex flex-col gap-2 pb-2 text-sm">
            <p>
              <strong>{labels.observation}: </strong>
              {story.observation}
            </p>
            <p>
              <strong>{labels.result}: </strong>
              {story.result}
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
          </div>
        </details>
      </div>

      {/* Other kinds of change: status and limits only, no invented shapes. */}
      {others.length > 0 && (
        <details className="rounded-xl border border-line bg-surface px-3 py-2">
          <summary className="min-h-11 cursor-pointer py-2 font-bold">{labels.otherLayers}</summary>
          <ul className="flex flex-col gap-2 pb-2 text-sm">
            {others.map((layer) => (
              <li key={layer.layer_id}>
                <span className="font-bold">{layer.name[lang]}</span>
                {" · "}
                {labels.status[layer.status as keyof Labels["status"]] ?? layer.status}
                <span className="block text-ink-soft">{layer.limitations[lang]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
