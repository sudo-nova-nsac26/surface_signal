"use client";

import type { ApiLayer } from "@/data/api-types";
import type { ComparisonDetail } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Labels = Dictionary["map"]["compare"];
export type InfoTab = "story" | "layers" | "tech";

const SHOWN_ON_MAP = new Set(["general_change", "radar_increase", "radar_decrease", "open_water"]);

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** Number and area formatting shared by the panel and the information box. */
export function makeFormat(lang: Locale, labels: Labels) {
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const number = (value: number | null | undefined, digits = 2) =>
    value == null
      ? labels.unavailable
      : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  // Small areas keep a third decimal so they never read as zero.
  const area = (value: number | null | undefined) =>
    value == null ? labels.unavailable : `${number(value, value < 0.1 ? 3 : 2)} ${labels.unit}`;
  return { number, area };
}

/** The three buttons on the left: each opens one kind of information. */
export function InfoButtons({
  labels,
  tab,
  onTab,
}: {
  labels: Labels;
  tab: InfoTab | null;
  onTab: (next: InfoTab | null) => void;
}) {
  const items: { id: InfoTab; name: string }[] = [
    { id: "story", name: labels.understand },
    { id: "layers", name: labels.otherLayers },
    { id: "tech", name: labels.technical },
  ];
  return (
    <div role="group" aria-label={labels.tabs} className="flex flex-col gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-expanded={tab === item.id}
          aria-controls="comparison-info"
          onClick={() => onTab(tab === item.id ? null : item.id)}
          className={`pressable flex min-h-11 items-center justify-between gap-2 rounded-xl border-2 px-3 text-left text-sm font-bold ${
            tab === item.id
              ? "border-brand bg-brand text-brand-ink hc:border-highlight hc:bg-highlight hc:text-highlight-ink"
              : "border-line bg-surface hover:border-brand hc:border-ink"
          }`}
        >
          {item.name}
          <span aria-hidden="true" className="text-xs">
            {tab === item.id ? "▾" : "▸"}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The information the chosen button opens, with a title and a close button. */
export function InfoContent({
  labels,
  lang,
  detail,
  tab,
  onClose,
}: {
  labels: Labels;
  lang: Locale;
  detail: ComparisonDetail;
  tab: InfoTab;
  onClose: () => void;
}) {
  const { number, area } = makeFormat(lang, labels);
  const story = detail.story;
  const g = detail.stats.general_change?.statistics;
  const w = detail.stats.open_water?.statistics;
  const params = detail.stats.general_change?.parameters;
  const others: ApiLayer[] = detail.layers.filter((layer) => !SHOWN_ON_MAP.has(layer.layer_id));
  const groups = (value: number | null | undefined) =>
    value == null ? null : fill(labels.groups, { count: number(value, 0) });
  const rows = [
    { label: labels.validArea, value: area(g?.valid_area_km2), extra: null as string | null },
    { label: labels.increase, value: area(g?.increase_area_km2), extra: groups(g?.increase_components) },
    { label: labels.decrease, value: area(g?.decrease_area_km2), extra: groups(g?.decrease_components) },
    { label: labels.changed, value: area(g?.changed_area_km2), extra: null },
    { label: labels.water, value: area(w?.candidate_area_km2), extra: groups(w?.candidate_components) },
  ];
  const title = tab === "story" ? labels.understand : tab === "layers" ? labels.otherLayers : labels.technical;

  return (
    <section id="comparison-info" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <button type="button" onClick={onClose} className="tool-button shrink-0">
          {labels.close}
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2 text-sm">
        {tab === "story" && (
          <>
            <p className="text-base font-bold">{story.summary}</p>
            <p>
              <strong>{labels.observation}: </strong>
              {story.observation}
            </p>
            <p>
              <strong>{labels.interpretation}: </strong>
              {story.interpretation}
              {story.water_interpretation ? ` ${story.water_interpretation}` : ""}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
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
          <ul className="grid gap-3 sm:grid-cols-2">
            {others.map((layer) => (
              <li key={layer.layer_id}>
                <span className="font-bold">{layer.name[lang]}</span>
                {" · "}
                {labels.status[layer.status as keyof Labels["status"]] ?? layer.status}
                <span className="block text-ink-soft">{layer.limitations[lang]}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "tech" && (
          <>
            <p className="text-ink-soft">{labels.technicalNote}</p>
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
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
            <p className="text-ink-soft">{story.result}</p>
            <p className="text-ink-soft">{labels.areaNote}</p>
          </>
        )}
      </div>
    </section>
  );
}
