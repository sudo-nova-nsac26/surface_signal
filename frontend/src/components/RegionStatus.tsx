"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AREA_LABELS, STORY_AREA_ID } from "@/data/area-labels";
import { loadRegionView, type RegionView } from "@/data/region";
import { listAreas } from "@/data/source";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { InfoIcon } from "./icons";

type Labels = Dictionary["region"];

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; region: RegionView };

/** Fills "{name}" placeholders in a sentence from the dictionaries. */
function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function useDateFormat(lang: Locale) {
  // Dates are shown in the region's own time, whatever the visitor's clock.
  const formatter = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  });
  return (iso: string) => formatter.format(new Date(iso));
}

function joinNames(names: string[], and: string) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/**
 * Shows what the data source has for the story region, in plain words.
 * It is the first screen that reads through the data layer, so it works the
 * same against the bundled snapshot and against the live backend.
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
  /** Section number shown beside the title. */
  number?: string;
  /** Shown at the end of the title row (the "Listen" button). */
  action?: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const formatDate = useDateFormat(lang);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const areas = await listAreas(controller.signal);
        const area =
          areas.find((item) => item.area_id === STORY_AREA_ID) ?? areas[0];
        if (!area) throw new Error("No area available");
        const region = await loadRegionView(area, controller.signal);
        setState({ status: "ready", region });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  return (
    <div aria-busy={state.status === "loading"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 id="region-title" className="flex items-baseline gap-4">
        {number && (
          <span
            aria-hidden="true"
            className="text-xl font-bold tabular-nums text-brand-text"
          >
            {number}
          </span>
        )}
        <span className="text-4xl font-bold tracking-tight sm:text-5xl">
          {labels.title}
        </span>
      </h2>
      {action}
      </div>

      <div className="mt-8 rounded-3xl border border-line bg-surface p-6 hc:border-2">
      {state.status === "loading" && (
        <p className="text-ink-soft" role="status">
          {labels.loading}
        </p>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-4" role="alert">
          <p>{labels.error}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
            className="pressable min-h-12 rounded-xl border-2 border-transparent bg-brand px-5 font-bold text-brand-ink hc:border-ink"
          >
            {labels.retry}
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <RegionDetails
          region={state.region}
          lang={lang}
          labels={labels}
          badge={badge}
          formatDate={formatDate}
        />
      )}
      </div>
    </div>
  );
}

function RegionDetails({
  region,
  lang,
  labels,
  badge,
  formatDate,
}: {
  region: RegionView;
  lang: Locale;
  labels: Labels;
  badge: string;
  formatDate: (iso: string) => string;
}) {
  const friendly = AREA_LABELS[region.areaId];
  const { comparison, latestPair } = region;

  let body: string;
  if (comparison) {
    body = fill(labels.analysisBody, {
      before: formatDate(comparison.beforeAt),
      after: formatDate(comparison.afterAt),
    });
  } else if (latestPair) {
    body = fill(labels.catalogBody, {
      count: region.sceneCount,
      before: formatDate(latestPair.beforeAt),
      after: formatDate(latestPair.afterAt),
    });
  } else {
    body = labels.noPairBody;
  }

  const river = comparison?.riverContext ?? [];
  const riverSource = river[0]?.source_url;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xl font-bold">
          {friendly ? friendly.name[lang] : region.name}
          {friendly && (
            <span className="block text-base font-normal text-ink-soft">
              {friendly.place[lang]}
            </span>
          )}
        </p>
        <span className="rounded-full bg-ink px-3 py-1 text-base font-bold text-surface">
          {labels.availability[region.availability]}
        </span>
        {comparison?.illustrative && (
          <span className="rounded-full bg-highlight px-3 py-1 text-base font-bold text-highlight-ink">
            {badge}
          </span>
        )}
      </div>

      <p>{body}</p>

      {comparison?.illustrative && (
        <p className="flex gap-2 text-ink-soft">
          <InfoIcon className="mt-0.5 shrink-0" />
          {labels.illustrativeBody}
        </p>
      )}

      {river.length > 0 && (
        <p className="text-ink-soft">
          {fill(labels.river, {
            stations: joinNames(
              river.map((record) => record.station),
              labels.and,
            ),
            hours: Math.abs(river[0].time_offset_hours)
              .toFixed(1)
              .replace(".", lang === "pt" ? "," : "."),
          })}{" "}
          {riverSource && (
            <a
              href={riverSource}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-brand-text underline"
            >
              {labels.source}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
