"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AREA_LABELS, STORY_AREA_ID } from "@/data/area-labels";
import {
  loadComparisonDetail,
  loadRegionView,
  type ComparisonDetail,
  type RegionView,
} from "@/data/region";
import { listAreas } from "@/data/source";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Labels = Dictionary["region"];
type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; region: RegionView; detail: ComparisonDetail | null };

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function numberFormat(value: number | null | undefined, lang: Locale, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function dateFormat(value: string, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

/**
 * Reviewer-facing summary of the actual prepared radar comparison.
 * Never use illustrative fallback figures: all displayed measurements come
 * from the immutable statistics endpoint, and missing values remain unknown.
 * Reprocessing, field validation and expanded AOIs are future work
 * (see docs/future-work.md), not actions performed in the browser.
 */
export function RegionStatus({
  lang,
  labels,
  badge,
  number,
  action,
}: {
  lang: Locale;
  labels: Labels;
  badge: string;
  number?: string;
  action?: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const areas = await listAreas(controller.signal);
        const area = areas.find((item) => item.area_id === STORY_AREA_ID) ?? areas[0];
        if (!area) throw new Error("No pilot area available");
        const region = await loadRegionView(area, controller.signal);

        // Never load a hard-coded July record if the selected area has no pair.
        let detail: ComparisonDetail | null = null;
        if (region.comparison) {
          try {
            detail = await loadComparisonDetail(
              region.comparison.analysisId,
              lang,
              controller.signal,
            );
          } catch {
            // Real comparisons may have missing detail; never substitute demo data.
            if (controller.signal.aborted) return;
            // Missing detail is represented as unavailable in the UI.
          }
        }
        if (!controller.signal.aborted) setState({ status: "ready", region, detail });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [attempt, lang]);

  const details = state.status === "ready" ? state.detail : null;
  const g = details?.stats.general_change?.statistics;
  const w = details?.stats.open_water?.statistics;
  const area = (value: number | null | undefined) => {
    const formatted = numberFormat(value, lang, value != null && value < 0.1 ? 3 : 2);
    return formatted == null ? labels.unavailable : formatted + " km²";
  };
  const pixels = (value: number | null | undefined) =>
    numberFormat(value, lang, 0) ?? labels.unavailable;
  const db = (value: number | null | undefined) => {
    const formatted = numberFormat(value, lang);
    if (formatted == null) return labels.unavailable;
    return (value != null && value > 0 ? "+" : "") + formatted + " dB";
  };
  const metrics = [
    { label: labels.metrics.valid, value: area(g?.valid_area_km2) },
    { label: labels.metrics.changed, value: area(g?.changed_area_km2) },
    { label: labels.metrics.increase, value: area(g?.increase_area_km2) },
    { label: labels.metrics.decrease, value: area(g?.decrease_area_km2) },
    { label: labels.metrics.water, value: area(w?.candidate_area_km2) },
  ];
  const distribution = g?.all_valid_delta_db?.percentiles;

  return (
    <div aria-busy={state.status === "loading"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="region-title" className="flex items-baseline gap-4">
          {number && <span aria-hidden="true" className="text-xl font-bold tabular-nums text-brand-text">{number}</span>}
          <span className="text-4xl font-bold tracking-tight sm:text-5xl">{labels.title}</span>
        </h2>
        {action}
      </div>
      <p className="mt-4 max-w-3xl text-xl text-ink-soft">{labels.intro}</p>

      <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {labels.steps.map((step, index) => (
          <li key={step.title} className="rounded-3xl border border-line bg-surface p-5 hc:border-2">
            <span className="text-sm font-bold text-brand-text">{index + 1}</span>
            <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 hc:border-2">
        {state.status === "loading" && <p role="status">{labels.loading}</p>}
        {state.status === "error" && (
          <div role="alert" className="flex flex-wrap items-center gap-4">
            <p>{labels.error}</p>
            <button
              type="button"
              className="min-h-12 rounded-xl border-2 border-line px-5 font-bold text-brand-text"
              onClick={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }}
            >
              {labels.retry}
            </button>
          </div>
        )}
        {state.status === "ready" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">
                  {AREA_LABELS[state.region.areaId]?.name[lang] ?? state.region.name}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {interpolate(labels.sceneCount, { count: state.region.sceneCount })}
                </p>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-sm font-semibold">
                {labels.availability[state.region.availability]}
              </span>
            </div>

            {state.region.comparison ? (
              <p className="mt-4">
                {interpolate(labels.analysisBody, {
                  before: dateFormat(state.region.comparison.beforeAt, lang),
                  after: dateFormat(state.region.comparison.afterAt, lang),
                })}
              </p>
            ) : state.region.latestPair ? (
              <p className="mt-4">
                {interpolate(labels.catalogBody, {
                  count: state.region.sceneCount,
                  before: dateFormat(state.region.latestPair.beforeAt, lang),
                  after: dateFormat(state.region.latestPair.afterAt, lang),
                })}
              </p>
            ) : (
              <p className="mt-4">{labels.noPairBody}</p>
            )}

            {state.region.comparison?.illustrative && (
              <p className="mt-3 rounded-xl border border-line px-3 py-2 text-sm">
                <strong>{badge}: </strong>{labels.illustrativeBody}
              </p>
            )}

            {state.region.comparison && (
              <>
                <h4 className="mt-6 text-lg font-bold">{labels.metricsTitle}</h4>
                <p className="mt-1 text-sm text-ink-soft">{labels.metricsNote}</p>
                {details ? (
                  <>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {metrics.map((metric) => (
                        <div key={metric.label} className="rounded-xl border border-line bg-bg/60 p-4">
                          <dt className="text-sm text-ink-soft">{metric.label}</dt>
                          <dd className="mt-1 text-xl font-bold tabular-nums">{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
                      <p>{labels.validPixels}: <strong className="text-ink">{pixels(g?.valid_pixels)}</strong></p>
                      <p>{labels.discardedComponents}: <strong className="text-ink">{pixels(g?.discarded_components)}</strong></p>
                    </div>
                    {distribution && (
                      <div className="mt-4">
                        <h5 className="font-semibold">{labels.percentilesTitle}</h5>
                        <dl className="mt-2 grid grid-cols-5 gap-2 text-center">
                          {(["5", "25", "50", "75", "95"] as const).map((p) => (
                            <div key={p} className="rounded-lg border border-line px-1 py-2">
                              <dt className="text-xs text-ink-soft">P{p}</dt>
                              <dd className="text-sm font-bold tabular-nums">{db(distribution[p])}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-ink-soft">{labels.noMetrics}</p>
                )}
                <p className="mt-5 text-sm text-ink-soft">{labels.validationNote}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
