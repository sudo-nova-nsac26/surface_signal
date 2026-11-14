"use client";

import type { TimelinePair, TimelineView } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Labels = Dictionary["map"]["timeline"];

const DAY = 86_400_000;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

/**
 * Every satellite pass over the place on one line of time, with the
 * comparisons that are ready drawn as bars and the river bulletins marked.
 * It reads only real catalog dates and whatever analyses the data source
 * has, so new results appear here without code changes.
 */
export function Timeline({
  data,
  lang,
  labels,
  illustrativeLabel,
  selectedId,
  onSelect,
}: {
  data: TimelineView;
  lang: Locale;
  labels: Labels;
  illustrativeLabel: string;
  selectedId: string | null;
  onSelect: (pair: TimelinePair) => void;
}) {
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const timeZone = "America/Sao_Paulo";
  const longDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone,
  });
  const shortDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone,
  });
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone,
  });
  const date = (iso: string) => longDate.format(new Date(iso));

  const times = [
    ...data.passes.map((pass) => Date.parse(pass.at)),
    ...data.events.map((event) => Date.parse(event.at)),
  ];
  if (times.length === 0) {
    return <p className="text-base text-ink-soft">{labels.empty}</p>;
  }
  const start = Math.min(...times) - 4 * DAY;
  const end = Math.max(...times) + 4 * DAY;
  const at = (iso: string) =>
    ((Date.parse(iso) - start) / (end - start)) * 100;

  // Month boundaries for the scale under the line.
  const months: { left: number; label: string }[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(12, 0, 0, 0);
  while (cursor.getTime() <= end) {
    const left = ((cursor.getTime() - start) / (end - start)) * 100;
    if (left >= 0) {
      months.push({ left, label: monthName.format(cursor) });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const selected = data.pairs.find((pair) => pair.analysisId === selectedId);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-bold">{labels.title}</h3>
        <p className="text-sm text-ink-soft">{labels.lead}</p>
      </div>

      <div className="relative h-24 select-none">
        {/* River bulletins: a marker line with a short label. */}
        {data.events.map((event) => (
          <div
            key={event.at + event.url}
            className="absolute top-0 bottom-6 flex flex-col items-center"
            style={{ left: `${at(event.at)}%`, transform: "translateX(-50%)" }}
          >
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              title={fill(labels.event, {
                date: date(event.at),
                stations: event.stations.join(", "),
              })}
              aria-label={fill(labels.event, {
                date: date(event.at),
                stations: event.stations.join(", "),
              })}
              className="whitespace-nowrap rounded-full bg-highlight px-2 py-0.5 text-xs font-bold text-highlight-ink"
            >
              ▲ {labels.eventShort}
            </a>
            <span aria-hidden="true" className="w-0.5 flex-1 bg-highlight" />
          </div>
        ))}

        {/* The line of time. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-8 h-0.5 rounded-full bg-line"
        />

        {/* Comparisons that are ready: a bar from before to after. */}
        <ul className="contents">
          {data.pairs.map((pair) => {
            const left = at(pair.beforeAt);
            const width = Math.max(at(pair.afterAt) - left, 1.5);
            const active = pair.analysisId === selectedId;
            return (
              <li key={pair.analysisId} className="contents">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${fill(labels.pair, {
                    before: date(pair.beforeAt),
                    after: date(pair.afterAt),
                  })}${pair.illustrative ? ` (${illustrativeLabel})` : ""}`}
                  title={fill(labels.pair, {
                    before: date(pair.beforeAt),
                    after: date(pair.afterAt),
                  })}
                  onClick={() => onSelect(pair)}
                  className={`absolute bottom-[1.6rem] h-3 rounded-full border-2 transition-colors ${
                    active
                      ? "border-brand bg-brand"
                      : "border-brand bg-brand-soft hover:bg-brand/60"
                  } ${pair.illustrative ? "border-dashed" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </li>
            );
          })}
        </ul>

        {/* Satellite passes. */}
        <ul className="contents">
          {data.passes.map((pass) => (
            <li
              key={pass.at}
              title={fill(labels.pass, { date: date(pass.at) })}
              className="absolute bottom-[1.85rem] size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-bg bg-ink"
              style={{ left: `${at(pass.at)}%` }}
            >
              <span className="sr-only">
                {fill(labels.pass, { date: date(pass.at) })}
              </span>
            </li>
          ))}
        </ul>

        {/* Month scale. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-5">
          {months.map((month) => (
            <span
              key={month.left}
              className="absolute text-xs uppercase tracking-wide text-ink-soft"
              style={{ left: `${month.left}%` }}
            >
              {month.label}
            </span>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="text-sm">
        {selected
          ? `${fill(labels.showing, {
              before: shortDate.format(new Date(selected.beforeAt)),
              after: shortDate.format(new Date(selected.afterAt)),
            })}${selected.illustrative ? ` (${illustrativeLabel})` : ""}`
          : labels.none}
      </p>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-ink" />
          {labels.legendPass}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-5 rounded-full border-2 border-brand bg-brand-soft"
          />
          {labels.legendPair}
        </li>
        {data.events.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-highlight">
              ▲
            </span>
            {labels.legendEvent}
          </li>
        )}
      </ul>
    </div>
  );
}
