"use client";

import { useEffect, useRef, useState } from "react";
import type { TimelineStep, TimelineView } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

import type { EnvironmentalEvent } from "@/data/api-types";
import { environmentalMarkers } from "@/data/environmental";

type Labels = Dictionary["map"]["timeline"];
type Featured = Dictionary["map"]["featured"];

const DAY = 86_400_000;
const PLAY_MS = 2600;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/**
 * A compact time bar along the bottom of the map: the chosen comparison, back
 * and forward, play, and a ruler of months where every pass is a dot and every
 * featured comparison is a marker you can press. The map, the numbers and the
 * explanation follow the chosen comparison.
 */
export function Timeline({
  data,
  lang,
  labels,
  featured,
  selectedId,
  onSelect,
  environmentalEvents = [],
  environmentLabels,
}: {
  data: TimelineView;
  lang: Locale;
  labels: Labels;
  featured: Featured;
  selectedId: string | null;
  onSelect: (step: TimelineStep) => void;
  environmentalEvents?: EnvironmentalEvent[];
  environmentLabels?: Dictionary["environment"];
}) {
  const [playing, setPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const steps = data.steps;
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === selectedId),
  );

  const latest = useRef({ index, steps, onSelect });
  useEffect(() => {
    latest.current = { index, steps, onSelect };
  });
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const { index, steps, onSelect } = latest.current;
      if (index >= steps.length - 1) {
        setPlaying(false);
        return;
      }
      onSelect(steps[index + 1]);
    }, PLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  // The stop menu closes on Escape or a click outside.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [menuOpen]);

  if (steps.length === 0) {
    return <p className="text-base text-ink-soft">{labels.empty}</p>;
  }

  const step = steps[index];
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const timeZone = "America/Sao_Paulo";
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone });
  const monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone });
  const date = (iso: string) => shortDate.format(new Date(iso)).replace(".", "");
  const compared = fill(labels.compared, { before: date(step.beforeAt), after: date(step.afterAt) });
  const title = (item: TimelineStep) => (item.reason ? featured[item.reason].title : date(item.afterAt));

  const move = (to: number) => {
    setPlaying(false);
    onSelect(steps[Math.min(steps.length - 1, Math.max(0, to))]);
  };

  // The ruler.
  const times = data.passes.map((pass) => Date.parse(pass.at));
  const start = Math.min(...times) - 3 * DAY;
  const end = Math.max(...times) + 3 * DAY;
  const at = (iso: string) => ((Date.parse(iso) - start) / (end - start)) * 100;
  const months: { left: number; label: string }[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(12, 0, 0, 0);
  while (cursor.getTime() <= end) {
    const left = ((cursor.getTime() - start) / (end - start)) * 100;
    if (left >= 0) months.push({ left, label: monthName.format(cursor).replace(".", "") });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const markers = environmentalMarkers(environmentalEvents, new Date(start).toISOString(), new Date(end).toISOString());
  const barLeft = at(step.beforeAt);
  const barWidth = Math.max(at(step.afterAt) - barLeft, 1.2);

  const bulletin = data.events.find(
    (event) => Math.abs(Date.parse(event.at) - Date.parse(step.afterAt)) < 1.5 * DAY,
  );
  const kind =
    step.direction === "ASCENDING" ? labels.morning : step.direction === "DESCENDING" ? labels.evening : null;

  const round =
    "pressable flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-base font-bold hover:border-brand hc:border-ink disabled:opacity-40";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Which comparison: a chip that opens the list of featured stops. */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-bg hc:bg-highlight hc:text-highlight-ink"
          >
            <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
            {title(step)}
            <span aria-hidden="true" className="text-xs">▾</span>
          </button>
          {menuOpen && (
            <ul
              role="listbox"
              aria-label={labels.slider}
              className="glass absolute bottom-full left-0 z-10 mb-2 flex w-64 flex-col gap-1 rounded-2xl p-2"
            >
              {steps.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    onClick={() => {
                      move(i);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-xl px-3 py-2 text-left ${
                      i === index ? "bg-brand text-brand-ink" : "hover:bg-surface"
                    }`}
                  >
                    <span className="text-sm font-bold">{title(item)}</span>
                    <span className="text-xs opacity-80">
                      {fill(labels.compared, { before: date(item.beforeAt), after: date(item.afterAt) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => move(index - 1)}
          disabled={index === 0}
          aria-label={labels.prev}
          title={labels.prev}
          className={round}
        >
          ‹
        </button>
        <span aria-live="polite" className="min-w-[8.5rem] text-center font-mono text-base font-bold tabular-nums">
          {compared}
        </span>
        <button
          type="button"
          onClick={() => move(index + 1)}
          disabled={index === steps.length - 1}
          aria-label={labels.next}
          title={labels.next}
          className={round}
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => {
            if (!playing && index >= steps.length - 1) onSelect(steps[0]);
            setPlaying((value) => !value);
          }}
          aria-pressed={playing}
          aria-label={playing ? labels.pause : labels.play}
          title={playing ? labels.pause : labels.play}
          className={`${round} ${playing ? "border-brand bg-brand-soft" : ""}`}
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
        </button>

        {/* The ruler: months, every pass, the chosen pair, featured markers. */}
        <div className="relative h-10 min-w-[12rem] flex-1 basis-full select-none sm:basis-auto">
          <div aria-hidden="true" className="absolute inset-x-0 top-3 h-0.5 rounded-full bg-line" />
          {months.map((month) => (
            <span
              key={month.left}
              aria-hidden="true"
              className="absolute top-1.5 h-3 w-px bg-ink-soft/50"
              style={{ left: `${month.left}%` }}
            />
          ))}
          <div
            aria-hidden="true"
            className="absolute top-2 h-2.5 rounded-full bg-brand transition-[left,width] duration-300"
            style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
          />
          {data.passes.map((pass) => (
            <span
              key={pass.at}
              aria-hidden="true"
              className="absolute top-3 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/70"
              style={{ left: `${at(pass.at)}%` }}
            />
          ))}
          {data.events
            .filter((event) => at(event.at) >= 0 && at(event.at) <= 100)
            .map((event) => (
            <span
              key={event.at + event.url}
              aria-hidden="true"
              className="absolute top-0 -translate-x-1/2 text-[0.6rem] text-highlight"
              style={{ left: `${at(event.at)}%` }}
            >
              ▼
            </span>
          ))}
          {steps.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => move(i)}
              aria-label={`${title(item)}, ${fill(labels.compared, { before: date(item.beforeAt), after: date(item.afterAt) })}`}
              title={title(item)}
              className={`absolute top-3 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center`}
              style={{ left: `${at(item.afterAt)}%` }}
            >
              <span
                className={`block size-3 rotate-45 border-2 ${
                  i === index ? "border-bg bg-brand" : "border-brand bg-bg"
                }`}
              />
            </button>
          ))}
          {markers.map((marker) =>
            marker.kind === "rainfall_window" ? (
              <span
                key={marker.key}
                aria-hidden="true"
                className="absolute top-0 h-1 border border-highlight bg-highlight/30"
                style={{
                  left: `${marker.startPercent}%`,
                  width: `${Math.max(0.3, marker.endPercent - marker.startPercent)}%`,
                }}
              />
            ) : (
              <span
                key={marker.key}
                aria-hidden="true"
                className="absolute -top-1 -translate-x-1/2 text-xs text-highlight"
                style={{ left: `${marker.endPercent}%` }}
              >
                {marker.kind === "station_measurement" ? "◆" : marker.kind === "reference" ? "□" : "▲"}
              </span>
            ),
          )}
          {months.map((month) => (
            <span
              key={`l${month.left}`}
              aria-hidden="true"
              className="absolute top-6 -translate-x-1/2 text-[0.7rem] font-bold uppercase tracking-wide text-ink-soft"
              style={{ left: `${month.left}%` }}
            >
              {month.label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        {kind ? `${kind} · ` : ""}
        {labels.sameGroup}
        {bulletin && (
          <>
            {" · "}
            <span className="text-highlight">▼</span>{" "}
            {fill(labels.river, { stations: bulletin.stations.join(", ") })}{" "}
            <a href={bulletin.url} target="_blank" rel="noreferrer" className="font-bold text-brand-text underline">
              {labels.source}
            </a>
          </>
        )}
      </p>
      {markers.length > 0 && environmentLabels && (
        <p className="text-xs text-ink-soft">
          {environmentLabels.events}: ◆ {environmentLabels.station_measurement} · ▰ {environmentLabels.rainfall_window} · □ {environmentLabels.reference}. {environmentLabels.eventDetails}
        </p>
      )}
    </div>
  );
}
