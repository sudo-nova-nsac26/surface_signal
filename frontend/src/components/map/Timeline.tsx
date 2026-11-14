"use client";

import { useEffect, useRef, useState } from "react";
import type { TimelineStep, TimelineView } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type Labels = Dictionary["map"]["timeline"];

const DAY = 86_400_000;
const PLAY_MS = 1800;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

/**
 * A timeline you move through: each step compares one satellite pass with the
 * previous pass of the same kind. Buttons, a slider and an automatic play
 * move forward and back; the map follows the chosen step. Only real catalog
 * dates are shown, plus whatever the data source has prepared, so results
 * appear here with no code change.
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
  onSelect: (step: TimelineStep) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const steps = data.steps;
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === selectedId),
  );

  // Keep the latest values for the timer without restarting it each time.
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

  if (steps.length === 0) {
    return <p className="text-base text-ink-soft">{labels.empty}</p>;
  }

  const step = steps[index];
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const timeZone = "America/Sao_Paulo";
  const longDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone,
  });
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone,
  });
  const date = (iso: string) => longDate.format(new Date(iso));

  const move = (to: number) => {
    setPlaying(false);
    onSelect(steps[Math.min(steps.length - 1, Math.max(0, to))]);
  };

  // The track: every pass is a dot, the chosen comparison is a bar.
  const times = data.passes.map((pass) => Date.parse(pass.at));
  const start = Math.min(...times) - 4 * DAY;
  const end = Math.max(...times) + 4 * DAY;
  const at = (iso: string) =>
    ((Date.parse(iso) - start) / (end - start)) * 100;
  const months: { left: number; label: string }[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(12, 0, 0, 0);
  while (cursor.getTime() <= end) {
    const left = ((cursor.getTime() - start) / (end - start)) * 100;
    if (left >= 0) months.push({ left, label: monthName.format(cursor) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const barLeft = at(step.beforeAt);
  const barWidth = Math.max(at(step.afterAt) - barLeft, 1.2);

  const status = step.analysis
    ? step.analysis.illustrative
      ? { name: labels.ready, body: labels.illustrativeBody, tone: "sample" }
      : { name: labels.ready, body: labels.readyBody, tone: "ready" }
    : { name: labels.notReady, body: labels.notReadyBody, tone: "pending" };

  // A river bulletin from the same day as this pass.
  const bulletin = data.events.find(
    (event) =>
      Math.abs(Date.parse(event.at) - Date.parse(step.afterAt)) < 1.5 * DAY,
  );

  const kind =
    step.direction === "ASCENDING"
      ? labels.morning
      : step.direction === "DESCENDING"
        ? labels.evening
        : null;

  const buttonClass =
    "pressable flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-line bg-surface px-3 text-lg font-bold hover:border-brand hc:border-ink disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-lg font-bold">{labels.title}</h3>
        <p className="text-sm font-bold text-brand-text">
          {fill(labels.counter, { current: index + 1, total: steps.length })}
        </p>
      </div>

      <div aria-live="polite">
        <p className="text-xl font-bold leading-snug">
          {fill(labels.compared, {
            after: date(step.afterAt),
            before: date(step.beforeAt),
          })}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-0.5 text-sm font-bold ${
              status.tone === "ready"
                ? "bg-brand text-brand-ink"
                : status.tone === "sample"
                  ? "bg-highlight text-highlight-ink"
                  : "border border-line text-ink-soft hc:border-ink hc:text-ink"
            }`}
          >
            {status.name}
            {status.tone === "sample" ? ` · ${illustrativeLabel}` : ""}
          </span>
          {kind && <span className="text-sm text-ink-soft">{kind}</span>}
        </div>
        <p className="mt-1 text-base text-ink-soft">{status.body}</p>
        {bulletin && (
          <p className="mt-1 text-base">
            <span aria-hidden="true" className="text-highlight">
              ▲{" "}
            </span>
            {fill(labels.river, { stations: bulletin.stations.join(", ") })}{" "}
            <a
              href={bulletin.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-brand-text underline"
            >
              {labels.source}
            </a>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => move(index - 1)}
          disabled={index === 0}
          aria-label={labels.prev}
          title={labels.prev}
          className={buttonClass}
        >
          ◀
        </button>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index}
          onChange={(event) => move(Number(event.target.value))}
          aria-label={labels.slider}
          aria-valuetext={fill(labels.compared, {
            after: date(step.afterAt),
            before: date(step.beforeAt),
          })}
          className="timeline-range min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => move(index + 1)}
          disabled={index === steps.length - 1}
          aria-label={labels.next}
          title={labels.next}
          className={buttonClass}
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => {
            if (!playing && index >= steps.length - 1) {
              onSelect(steps[0]);
            }
            setPlaying((value) => !value);
          }}
          aria-pressed={playing}
          className={`${buttonClass} gap-2 ${playing ? "border-brand bg-brand-soft" : ""}`}
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶▶"}</span>
          <span className="hidden text-base sm:inline">
            {playing ? labels.pause : labels.play}
          </span>
        </button>
      </div>

      {/* The track: decorative, the slider above is the control. */}
      <div aria-hidden="true" className="relative h-9 select-none">
        <div className="absolute inset-x-0 top-3 h-0.5 rounded-full bg-line" />
        <div
          className="absolute top-2 h-2.5 rounded-full bg-brand transition-[left,width] duration-300"
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
        {data.passes.map((pass) => (
          <span
            key={pass.at}
            className={`absolute top-3 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg ${
              pass.at === step.beforeAt || pass.at === step.afterAt
                ? "bg-brand"
                : "bg-ink"
            }`}
            style={{ left: `${at(pass.at)}%` }}
          />
        ))}
        {data.events.map((event) => (
          <span
            key={event.at + event.url}
            className="absolute top-3 -translate-x-1/2 -translate-y-1/2 text-xs text-highlight"
            style={{ left: `${at(event.at)}%` }}
          >
            ▲
          </span>
        ))}
        {months.map((month) => (
          <span
            key={month.left}
            className="absolute top-5 text-xs uppercase tracking-wide text-ink-soft"
            style={{ left: `${month.left}%` }}
          >
            {month.label}
          </span>
        ))}
      </div>
    </div>
  );
}
