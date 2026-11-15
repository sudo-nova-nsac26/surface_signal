"use client";

import { useId } from "react";
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

interface ProvenanceScene {
  scene_id?: string;
  size_bytes?: number;
  start_time?: string;
  track?: number;
  frame?: number;
  direction?: string;
  mode?: string;
  polarization?: string;
  release?: string;
  url?: string;
}

/** Number and area formatting shared by the panel and the information. */
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

/**
 * Three topics in the left card. Pressing one opens its information right
 * below it, inside the card, and the card scrolls; pressing it again closes it.
 */
export function InfoAccordion({
  labels,
  lang,
  detail,
  tab,
  onTab,
}: {
  labels: Labels;
  lang: Locale;
  detail: ComparisonDetail;
  tab: InfoTab | null;
  onTab: (next: InfoTab | null) => void;
}) {
  const uid = useId();
  const items: { id: InfoTab; name: string }[] = [
    { id: "story", name: labels.understand },
    { id: "layers", name: labels.otherLayers },
    { id: "tech", name: labels.technical },
  ];
  return (
    <div role="group" aria-label={labels.tabs} className="flex flex-col gap-1.5">
      {items.map((item) => {
        const open = tab === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              id={`${uid}-${item.id}-button`}
              aria-expanded={open}
              aria-controls={`${uid}-${item.id}`}
              onClick={() => onTab(open ? null : item.id)}
              className={`pressable flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border-2 px-3 text-left text-sm font-bold ${
                open
                  ? "border-brand bg-brand text-brand-ink hc:border-highlight hc:bg-highlight hc:text-highlight-ink"
                  : "border-line bg-surface hover:border-brand hc:border-ink"
              }`}
            >
              {item.name}
              <span aria-hidden="true" className="text-xs">
                {open ? "▾" : "▸"}
              </span>
            </button>
            {open && (
              <section
                id={`${uid}-${item.id}`}
                aria-labelledby={`${uid}-${item.id}-button`}
                className="rise-in mt-1.5 rounded-xl border border-line bg-surface p-3"
              >
                <InfoContent labels={labels} lang={lang} detail={detail} tab={item.id} />
              </section>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoContent({
  labels,
  lang,
  detail,
  tab,
}: {
  labels: Labels;
  lang: Locale;
  detail: ComparisonDetail;
  tab: InfoTab;
}) {
  const { number, area } = makeFormat(lang, labels);
  const story = detail.story;
  const g = detail.stats.general_change?.statistics;
  const w = detail.stats.open_water?.statistics;
  const params = detail.stats.general_change?.parameters;
  const wParams = detail.stats.open_water?.parameters;
  const others: ApiLayer[] = detail.layers.filter((layer) => !SHOWN_ON_MAP.has(layer.layer_id));
  const groups = (value: number | null | undefined) =>
    value == null ? null : fill(labels.groups, { count: number(value, 0) });

  const rows = [
    { label: labels.validArea, value: area(g?.valid_area_km2), extra: g?.valid_pixels != null ? `${number(g.valid_pixels, 0)} px (10×10 m)` : null },
    { label: labels.increase, value: area(g?.increase_area_km2), extra: groups(g?.increase_components) },
    { label: labels.decrease, value: area(g?.decrease_area_km2), extra: groups(g?.decrease_components) },
    { label: labels.changed, value: area(g?.changed_area_km2), extra: g?.changed_percent != null ? `${number(g.changed_percent, 2)}%` : null },
    { label: labels.water, value: area(w?.candidate_area_km2), extra: groups(w?.candidate_components) },
  ];

  // Extract HDF5 provenance metadata from story.methodology when available
  const methodology = (story.methodology ?? {}) as Record<string, unknown>;
  const provenance = (methodology.provenance ?? {}) as Record<string, unknown>;
  const scenes = Array.isArray(provenance.scenes) ? (provenance.scenes as ProvenanceScene[]) : [];
  const alignment = (provenance.alignment ?? {}) as { target_crs?: string };
  const inputHashes = Array.isArray(provenance.input_sha256) ? (provenance.input_sha256 as string[]) : [];
  const allDelta = g?.all_valid_delta_db;

  const formatDb = (val: number | null | undefined) => {
    if (val == null) return "—";
    const sign = val > 0 ? "+" : "";
    return `${sign}${number(val, 2)} dB`;
  };

  return (
    <div className="flex flex-col gap-2.5 text-sm">
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
              <span className="block text-ink-soft">{layer.limitations[lang]}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "tech" && (
        <>
          {/* Step-by-step HDF5 translation summary inside the map */}
          <div className="rounded-xl border border-brand/40 bg-bg/70 p-2.5 text-xs leading-relaxed">
            <p className="font-bold uppercase tracking-wider text-brand-text">
              {lang === "pt"
                ? "🔬 Como traduzimos o HDF5 neste período"
                : "🔬 How we translated the HDF5 in this period"}
            </p>
            <ol className="mt-1.5 flex flex-col gap-1 text-ink-soft">
              <li>
                <strong className="text-ink">1. HDF5 GCOV:</strong>{" "}
                {lang === "pt"
                  ? `Banda L (24 cm, canal ${ String(wParams?.channel ?? "HHHH") }), grade ${alignment.target_crs ?? "EPSG:32722"} de 10×10 m (100 m²/pixel).`
                  : `L-band (24 cm, channel ${String(wParams?.channel ?? "HHHH")}), ${alignment.target_crs ?? "EPSG:32722"} 10×10 m grid (100 m²/pixel).`}
              </li>
              <li>
                <strong className="text-ink">2. {lang === "pt" ? "Filtro Speckle:" : "Speckle filter:"}</strong>{" "}
                {lang === "pt"
                  ? `Descartados ${number(g?.discarded_components, 0)} micro-ruídos isolados (< ${number(params?.min_component_pixels ?? 9, 0)} px = ${area(g?.discarded_area_km2)}).`
                  : `Discarded ${number(g?.discarded_components, 0)} isolated noise specks (< ${number(params?.min_component_pixels ?? 9, 0)} px = ${area(g?.discarded_area_km2)}).`}
              </li>
              <li>
                <strong className="text-ink">3. {lang === "pt" ? "Limiares físicos:" : "Physical thresholds:"}</strong>{" "}
                {lang === "pt"
                  ? `|Δγ⁰| ≥ ${number(params?.threshold_db ?? 3, 1)} dB para mudança e γ⁰ ≤ ${number(Number(wParams?.water_threshold ?? -17), 0)} dB para água aberta.`
                  : `|Δγ⁰| ≥ ${number(params?.threshold_db ?? 3, 1)} dB for change and γ⁰ ≤ ${number(Number(wParams?.water_threshold ?? -17), 0)} dB for open water.`}
              </li>
            </ol>
          </div>

          <p className="text-xs text-ink-soft">{labels.technicalNote}</p>

          <dl className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 border-b border-line pb-1.5">
                <dt>{row.label}</dt>
                <dd className="text-right font-bold tabular-nums">
                  {row.value}
                  {row.extra && <span className="block text-xs font-normal text-ink-soft">{row.extra}</span>}
                </dd>
              </div>
            ))}
            {params?.threshold_db != null && (
              <div className="flex justify-between gap-3 border-b border-line pb-1.5">
                <dt>{labels.threshold}</dt>
                <dd className="font-bold tabular-nums">± {number(params.threshold_db, 1)} dB</dd>
              </div>
            )}
            {params?.min_component_pixels != null && (
              <div className="flex justify-between gap-3 border-b border-line pb-1.5">
                <dt>{labels.minGroup}</dt>
                <dd className="font-bold tabular-nums">
                  {number(params.min_component_pixels, 0)} {labels.pixelsUnit} (900 m²)
                </dd>
              </div>
            )}
          </dl>

          {/* Backscatter distribution percentiles (Δγ⁰ dB) */}
          {allDelta && (
            <div className="rounded-xl border border-line bg-bg/60 p-2.5 text-xs">
              <p className="font-bold text-ink">
                {lang === "pt"
                  ? "📊 Distribuição radiométrica Δγ⁰ (pixels válidos)"
                  : "📊 Radiometric distribution Δγ⁰ (valid pixels)"}
              </p>
              <div className="mt-2 grid grid-cols-5 gap-1 text-center font-mono text-[0.7rem]">
                <div className="rounded bg-surface p-1">
                  <span className="block text-[0.62rem] text-ink-soft">P5</span>
                  <strong className="text-decrease">{formatDb(allDelta.percentiles["5"])}</strong>
                </div>
                <div className="rounded bg-surface p-1">
                  <span className="block text-[0.62rem] text-ink-soft">P25</span>
                  <strong className="text-ink">{formatDb(allDelta.percentiles["25"])}</strong>
                </div>
                <div className="rounded border border-brand/40 bg-surface p-1">
                  <span className="block text-[0.62rem] text-brand-text">P50</span>
                  <strong className="text-brand-text">{formatDb(allDelta.percentiles["50"])}</strong>
                </div>
                <div className="rounded bg-surface p-1">
                  <span className="block text-[0.62rem] text-ink-soft">P75</span>
                  <strong className="text-ink">{formatDb(allDelta.percentiles["75"])}</strong>
                </div>
                <div className="rounded bg-surface p-1">
                  <span className="block text-[0.62rem] text-ink-soft">P95</span>
                  <strong className="text-increase">{formatDb(allDelta.percentiles["95"])}</strong>
                </div>
              </div>
              <p className="mt-1.5 flex justify-between font-mono text-[0.68rem] text-ink-soft">
                <span>Min: {formatDb(allDelta.min)}</span>
                <span>{lang === "pt" ? "Média:" : "Mean:"} {formatDb(allDelta.mean)}</span>
                <span>Max: {formatDb(allDelta.max)}</span>
              </p>
            </div>
          )}

          {/* Raw HDF5 Granule Inspector inside the map */}
          {scenes.length > 0 && (
            <div className="rounded-xl border border-line bg-bg/60 p-2.5 text-xs">
              <p className="font-bold text-ink">
                {lang === "pt"
                  ? "🛰️ Arquivos brutos HDF5 comparados (NASA ASF)"
                  : "🛰️ Compared raw HDF5 granules (NASA ASF)"}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {scenes.map((sc, idx) => {
                  const gb = sc.size_bytes ? (sc.size_bytes / 1e9).toFixed(2) : null;
                  const sha = inputHashes[idx]?.slice(0, 12);
                  return (
                    <li key={sc.scene_id ?? idx} className="rounded-lg border border-line/70 bg-surface p-2">
                      <div className="flex items-center justify-between gap-2 text-[0.68rem] font-bold text-brand-text">
                        <span>{idx === 0 ? (lang === "pt" ? "ANTES (T0)" : "BEFORE (T0)") : (lang === "pt" ? "DEPOIS (T1)" : "AFTER (T1)")}</span>
                        <span>
                          Track {sc.track} · Frame {sc.frame} · {sc.polarization}
                          {gb ? ` · ${gb} GB` : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 break-all font-mono text-[0.66rem] text-ink">
                        {sc.scene_id}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[0.65rem] text-ink-soft">
                        {sha && <span className="font-mono">SHA-256: {sha}…</span>}
                        {sc.url && (
                          <a
                            href={sc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-brand-text underline"
                          >
                            {lang === "pt" ? "Baixar .h5 ↗" : "Download .h5 ↗"}
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-xs text-ink-soft">{ labels.areaNote }</p>
        </>
      )}
    </div>
  );
}
