"use client";

import { useEffect, useRef, useState } from "react";
import type { TimelineStep, TimelineView } from "@/data/region";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { EnvironmentalEvent } from "@/data/api-types";

type Labels = Dictionary["map"]["timeline"];
type Featured = Dictionary["map"]["featured"];

const DAY = 86_400_000;
const PLAY_MS = 2600;
const PITCH_KM2 = 0.00714;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function pitches(km2: number | null | undefined): number {
  if (!km2 || km2 <= 0) return 0;
  const n = km2 / PITCH_KM2;
  if (n < 20) return Math.max(1, Math.round(n));
  if (n < 100) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

/**
 * RoamingEye-inspired draggable time bar along the bottom of the map:
 * - Left: comparison selector pill, < date >, and Play/Pause button.
 * - Centre: clean tick ruler where users can click or drag the round thumb
 *   smoothly across the entire June–October season.
 * - Right: SAR dB scale + non-sequential period comparator ("1st vs. Last").
 */
export function Timeline({
  data,
  lang,
  labels,
  featured,
  selectedId,
  onSelect,
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareActive, setCompareActive] = useState(false);
  const [pairAIdx, setPairAIdx] = useState<number>(0);
  const [pairBIdx, setPairBIdx] = useState<number>(() => Math.max(0, data.steps.length - 1));
  const [dragPercent, setDragPercent] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const steps = data.steps;
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === selectedId),
  );

  // Ensure default B index is the last step once steps are loaded.
  useEffect(() => {
    if (steps.length > 1) {
      setPairBIdx((prev) => (prev >= steps.length || prev === 0 ? steps.length - 1 : prev));
    }
  }, [steps.length]);

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

  // Close dropdown menu on Escape or outside click.
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
  const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const date = (iso: string) => shortDate.format(new Date(iso)).replace(".", "");
  const compared = fill(labels.compared, { before: date(step.beforeAt), after: date(step.afterAt) });

  const stepTitle = (item: TimelineStep, idx?: number) => {
    if (item.reason) return featured[item.reason].title;
    if (idx === 0) return lang === "pt" ? "1ª leitura (Jun)" : "1st reading (Jun)";
    if (idx === steps.length - 1) return lang === "pt" ? "Última leitura (Out)" : "Latest reading (Oct)";
    return `${date(item.beforeAt)} → ${date(item.afterAt)}`;
  };

  const move = (to: number) => {
    setPlaying(false);
    const clamped = Math.min(steps.length - 1, Math.max(0, to));
    onSelect(steps[clamped]);
  };

  // Ruler time geometry.
  const times = data.passes.map((pass) => Date.parse(pass.at));
  const start = Math.min(...times) - 2 * DAY;
  const end = Math.max(...times) + 2 * DAY;
  const at = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - start) / (end - start)) * 100));

  // Generate 28 evenly spaced RoamingEye-style ruler ticks.
  const TICKS = 28;
  const tickPercents = Array.from({ length: TICKS + 1 }, (_, i) => (i / TICKS) * 100);

  // Month labels under the ruler.
  const months: { left: number; label: string }[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(12, 0, 0, 0);
  while (cursor.getTime() <= end) {
    const left = ((cursor.getTime() - start) / (end - start)) * 100;
    if (left >= 2 && left <= 98) {
      months.push({ left, label: monthName.format(cursor).replace(".", "").toUpperCase() });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  // Position of each step along the ruler (by its afterAt acquisition time).
  const stepPositions = steps.map((s) => at(s.afterAt));
  const activeThumbLeft = dragPercent !== null ? dragPercent : stepPositions[index] ?? 50;

  // Scrubbing handler: maps pointer X to nearest comparison step.
  const scrubAtClientX = (clientX: number, commitOnly = false) => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    if (!commitOnly) setDragPercent(pct);

    // Find closest step by ruler percentage.
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < stepPositions.length; i++) {
      const dist = Math.abs(stepPositions[i] - pct);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx !== index) {
      setPlaying(false);
      onSelect(steps[bestIdx]);
    }
  };

  const bulletin = data.events.find(
    (event) => Math.abs(Date.parse(event.at) - Date.parse(step.afterAt)) < 1.5 * DAY,
  );
  const kind =
    step.direction === "ASCENDING" ? labels.morning : step.direction === "DESCENDING" ? labels.evening : null;

  // Non-sequential comparison data (Step A vs Step B).
  const stepA = steps[pairAIdx] ?? steps[0];
  const stepB = steps[pairBIdx] ?? steps[steps.length - 1];
  const waterA = stepA?.analysis?.candidateAreaKm2 ?? 0;
  const waterB = stepB?.analysis?.candidateAreaKm2 ?? 0;
  const chgA = stepA?.analysis?.changedAreaKm2 ?? 0;
  const chgB = stepB?.analysis?.changedAreaKm2 ?? 0;
  const floodIdx = Math.max(0, steps.findIndex((s) => s.reason === "flood"));

  return (
    <div className="relative flex flex-col gap-2">
      {/* Active comparison banner when confirmed on the map */}
      {compareActive && !compareOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-brand bg-surface/95 px-3 py-2 text-xs shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-extrabold text-brand-ink">
              ⚡ {lang === "pt" ? "COMPARANDO NO MAPA" : "COMPARING ON MAP"}
            </span>
            <button
              type="button"
              onClick={() => move(pairAIdx)}
              className={`rounded-lg border px-2.5 py-1 font-bold transition ${
                index === pairAIdx
                  ? "border-brand bg-brand/20 text-brand-text"
                  : "border-line bg-bg text-ink-soft hover:border-brand hover:text-ink"
              }`}
            >
              {index === pairAIdx ? "● " : ""}
              {lang === "pt" ? "Período A:" : "Period A:"} {date(stepA.beforeAt)} → {date(stepA.afterAt)}
            </button>
            <span className="font-bold text-ink-soft">⇄</span>
            <button
              type="button"
              onClick={() => move(pairBIdx)}
              className={`rounded-lg border px-2.5 py-1 font-bold transition ${
                index === pairBIdx
                  ? "border-highlight bg-highlight/20 text-highlight"
                  : "border-line bg-bg text-ink-soft hover:border-highlight hover:text-ink"
              }`}
            >
              {index === pairBIdx ? "● " : ""}
              {lang === "pt" ? "Período B:" : "Period B:"} {date(stepB.beforeAt)} → {date(stepB.afterAt)}
            </button>
            <span className="hidden rounded-lg border border-line bg-bg/80 px-2 py-1 text-ink-soft xl:inline-block">
              Δ {lang === "pt" ? "Água:" : "Water:"}{" "}
              <strong className="text-brand-text">
                {waterB - waterA >= 0 ? "+" : ""}
                {numFmt.format(waterB - waterA)} km²
              </strong>{" "}
              · Δ {lang === "pt" ? "Mudança:" : "Changed:"}{" "}
              <strong className="text-ink">
                {chgB - chgA >= 0 ? "+" : ""}
                {numFmt.format(chgB - chgA)} km²
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="rounded-lg border border-line bg-bg px-2.5 py-1 font-bold text-ink hover:border-brand"
            >
              {lang === "pt" ? "Trocar A/B" : "Change A/B"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCompareActive(false);
                setCompareOpen(false);
              }}
              className="rounded-lg border border-red-400/60 bg-red-950/60 px-2.5 py-1 font-bold text-red-200 hover:bg-red-500 hover:text-slate-950"
            >
              ✕ {lang === "pt" ? "Sair da comparação" : "Exit comparison"}
            </button>
          </div>
        </div>
      )}

      {/* Non-sequential period comparator drawer (e.g., 1st vs. Last reading or Flood vs. Latest). */}
      {compareOpen && (
        <div className="glass mb-1 rounded-2xl border border-brand/50 bg-surface/95 p-3 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-brand/15 px-2 py-0.5 text-xs font-extrabold text-brand-text">
                ⇄ {lang === "pt" ? "Comparador Livre de Períodos" : "Non-Sequential Period Comparator"}
              </span>
              <span className="text-xs text-ink-soft">
                {lang === "pt"
                  ? "Compare leituras distantes no tempo (ex.: 1ª leitura vs. Última leitura)"
                  : "Compare non-consecutive readings (e.g., 1st reading vs. Latest reading)"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPairAIdx(0);
                  setPairBIdx(steps.length - 1);
                }}
                className="rounded-lg border border-line bg-bg px-2 py-1 text-[11px] font-bold text-ink hover:border-brand"
              >
                {lang === "pt" ? "⚡ 1ª vs. Última (Jun × Out)" : "⚡ 1st vs. Latest (Jun × Oct)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPairAIdx(floodIdx);
                  setPairBIdx(steps.length - 1);
                }}
                className="rounded-lg border border-line bg-bg px-2 py-1 text-[11px] font-bold text-ink hover:border-brand"
              >
                {lang === "pt" ? "🌊 Cheia vs. Última (Jul × Out)" : "🌊 Flood vs. Latest (Jul × Oct)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareOpen(false);
                  setCompareActive(false);
                }}
                aria-label={lang === "pt" ? "Sair da comparação" : "Exit comparison"}
                className="flex items-center gap-1 rounded-lg border border-red-400/60 bg-red-950/60 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-500 hover:text-slate-950"
              >
                ✕ {lang === "pt" ? "Sair da comparação" : "Exit comparison"}
              </button>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
            {/* Period A selector & metrics */}
            <div className="rounded-xl border border-line bg-bg/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="period-a-select" className="text-[11px] font-bold uppercase tracking-wider text-brand-text">
                  {lang === "pt" ? "Período A (Base)" : "Period A (Base)"}
                </label>
                <button
                  type="button"
                  onClick={() => move(pairAIdx)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    index === pairAIdx
                      ? "bg-brand text-brand-ink"
                      : "border border-line bg-surface text-ink hover:border-brand"
                  }`}
                >
                  {index === pairAIdx
                    ? lang === "pt"
                      ? "● No mapa"
                      : "● On map"
                    : lang === "pt"
                      ? "Ver no mapa"
                      : "Show on map"}
                </button>
              </div>
              <select
                id="period-a-select"
                value={pairAIdx}
                onChange={(e) => setPairAIdx(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-bold text-ink"
              >
                {steps.map((s, idx) => (
                  <option key={s.id} value={idx}>
                    {idx + 1}. {stepTitle(s, idx)} ({date(s.beforeAt)} → {date(s.afterAt)})
                  </option>
                ))}
              </select>
              <div className="mt-2 flex justify-between text-xs text-ink-soft">
                <span>
                  {lang === "pt" ? "Água:" : "Water:"}{" "}
                  <strong className="text-ink">{numFmt.format(waterA)} km²</strong> ({pitches(waterA)}{" "}
                  {lang === "pt" ? "campos" : "pitches"})
                </span>
                <span>
                  {lang === "pt" ? "Mudança:" : "Changed:"}{" "}
                  <strong className="text-ink">{numFmt.format(chgA)} km²</strong>
                </span>
              </div>
            </div>

            {/* Period B selector & metrics */}
            <div className="rounded-xl border border-line bg-bg/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="period-b-select" className="text-[11px] font-bold uppercase tracking-wider text-highlight">
                  {lang === "pt" ? "Período B (Comparado)" : "Period B (Compared)"}
                </label>
                <button
                  type="button"
                  onClick={() => move(pairBIdx)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    index === pairBIdx
                      ? "bg-highlight text-highlight-ink"
                      : "border border-line bg-surface text-ink hover:border-highlight"
                  }`}
                >
                  {index === pairBIdx
                    ? lang === "pt"
                      ? "● No mapa"
                      : "● On map"
                    : lang === "pt"
                      ? "Ver no mapa"
                      : "Show on map"}
                </button>
              </div>
              <select
                id="period-b-select"
                value={pairBIdx}
                onChange={(e) => setPairBIdx(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-bold text-ink"
              >
                {steps.map((s, idx) => (
                  <option key={s.id} value={idx}>
                    {idx + 1}. {stepTitle(s, idx)} ({date(s.beforeAt)} → {date(s.afterAt)})
                  </option>
                ))}
              </select>
              <div className="mt-2 flex justify-between text-xs text-ink-soft">
                <span>
                  {lang === "pt" ? "Água:" : "Water:"}{" "}
                  <strong className="text-ink">{numFmt.format(waterB)} km²</strong> ({pitches(waterB)}{" "}
                  {lang === "pt" ? "campos" : "pitches"})
                </span>
                <span>
                  {lang === "pt" ? "Mudança:" : "Changed:"}{" "}
                  <strong className="text-ink">{numFmt.format(chgB)} km²</strong>
                </span>
              </div>
            </div>

            {/* Direct Delta Summary (A -> B) + Confirm Button */}
            <div className="flex flex-col justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-2.5 text-xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text">
                  {lang === "pt" ? "Diferença entre A e B" : "Difference between A & B"}
                </span>
                <p className="mt-1 text-ink">
                  {lang === "pt" ? "Água candidata:" : "Candidate water:"}{" "}
                  <strong className="text-brand-text">
                    {waterB - waterA >= 0 ? "+" : ""}
                    {numFmt.format(waterB - waterA)} km²
                  </strong>{" "}
                  ({waterB < waterA
                    ? lang === "pt"
                      ? "recuo / drenagem"
                      : "receded / drained"
                    : waterB > waterA
                      ? lang === "pt"
                        ? "expansão"
                        : "expanded"
                      : lang === "pt"
                        ? "estável"
                        : "stable"})
                </p>
                <p className="mt-0.5 text-ink-soft">
                  {lang === "pt" ? "Superfície alterada:" : "Altered surface:"}{" "}
                  <strong className="text-ink">
                    {chgB - chgA >= 0 ? "+" : ""}
                    {numFmt.format(chgB - chgA)} km²
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompareActive(true);
                  setCompareOpen(false);
                  move(pairBIdx);
                }}
                className="pressable w-full rounded-xl bg-brand px-3 py-2 text-center text-xs font-extrabold text-brand-ink shadow transition hover:opacity-95"
              >
                ✓ {lang === "pt" ? "Confirmar e comparar no mapa" : "Confirm & compare on map"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main RoamingEye-style horizontal bar */}
      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
        {/* Left Pill Selector (like "Greenness ▾" in RoamingEye) */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            className="flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-bg shadow-sm transition hover:opacity-95 hc:bg-highlight hc:text-highlight-ink"
          >
            <span aria-hidden="true" className="size-2.5 rounded-full bg-brand hc:bg-bg" />
            <span className="max-w-[10.5rem] truncate">{stepTitle(step, index)}</span>
            <span aria-hidden="true" className="text-xs opacity-80">▾</span>
          </button>
          {menuOpen && (
            <ul
              role="listbox"
              aria-label={labels.slider}
              className="glass absolute bottom-full left-0 z-30 mb-2 flex max-h-72 w-72 flex-col gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-2xl"
            >
              {steps.map((item, i) => (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    onClick={() => {
                      move(i);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                      i === index ? "bg-brand text-brand-ink font-bold" : "hover:bg-bg/80 text-ink"
                    }`}
                  >
                    <span className="font-bold">{stepTitle(item, i)}</span>
                    <span className="font-mono opacity-80">
                      {date(item.beforeAt)} → {date(item.afterAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Date stepper (< Oct 2026 >) */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => move(index - 1)}
            disabled={index === 0}
            aria-label={labels.prev}
            title={labels.prev}
            className="flex size-8 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition hover:bg-surface hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>
          <span
            aria-live="polite"
            className="min-w-[8rem] text-center text-sm font-bold tracking-tight text-ink sm:text-base"
          >
            {compared}
          </span>
          <button
            type="button"
            onClick={() => move(index + 1)}
            disabled={index === steps.length - 1}
            aria-label={labels.next}
            title={labels.next}
            className="flex size-8 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition hover:bg-surface hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {/* Round Play / Pause Button */}
        <button
          type="button"
          onClick={() => {
            if (!playing && index >= steps.length - 1) onSelect(steps[0]);
            setPlaying((value) => !value);
          }}
          aria-pressed={playing}
          aria-label={playing ? labels.pause : labels.play}
          title={playing ? labels.pause : labels.play}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-bold transition hover:border-brand ${
            playing ? "border-brand bg-brand-soft text-brand-text" : "text-ink"
          }`}
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
        </button>

        {/* RoamingEye-Style Draggable Tick Ruler */}
        <div
          ref={rulerRef}
          role="slider"
          tabIndex={0}
          aria-label={labels.slider}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-valuetext={`${stepTitle(step, index)} (${compared})`}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              move(index - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              move(index + 1);
            }
          }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubAtClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) scrubAtClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (draggingRef.current) {
              draggingRef.current = false;
              setDragPercent(null);
              scrubAtClientX(e.clientX, true);
            }
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            setDragPercent(null);
          }}
          className="relative mx-2 h-11 min-w-[12rem] flex-1 basis-full cursor-ew-resize touch-none select-none sm:basis-auto"
        >
          {/* Horizontal top rail */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-2.5 h-[1.5px] bg-ink-soft/45"
          />
          {/* Progress highlight along rail up to active thumb */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-2.5 h-[2px] bg-brand/80 transition-[width] duration-75"
            style={{ width: `${activeThumbLeft}%` }}
          />

          {/* Evenly spaced RoamingEye vertical ruler ticks */}
          {tickPercents.map((left, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`absolute top-2.5 w-px -translate-x-1/2 ${
                i % 4 === 0 ? "h-3 bg-ink-soft/70" : "h-2 bg-ink-soft/35"
              }`}
              style={{ left: `${left}%` }}
            />
          ))}

          {/* Subtle step snap notches */}
          {stepPositions.map((left, i) => (
            <span
              key={steps[i].id}
              aria-hidden="true"
              className={`absolute top-2.5 h-3.5 w-[2px] -translate-x-1/2 rounded-full ${
                steps[i].reason === "flood" ? "bg-highlight" : "bg-brand/70"
              }`}
              style={{ left: `${left}%` }}
            />
          ))}

          {/* Month labels cleanly aligned under the ticks */}
          {months.map((month) => (
            <span
              key={month.label + month.left}
              aria-hidden="true"
              className="absolute top-6 -translate-x-1/2 font-mono text-[11px] font-bold tracking-wider text-ink-soft"
              style={{ left: `${month.left}%` }}
            >
              {month.label}
            </span>
          ))}

          {/* Draggable Circular Thumb (RoamingEye style) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-slate-500/90 bg-white shadow-[0_0_12px_rgba(25,227,255,0.6)] transition-[left] duration-75"
            style={{ left: `${activeThumbLeft}%` }}
          />
        </div>

        {/* Right mini SAR scale + Non-Sequential Comparator Toggle */}
        <div className="hidden shrink-0 items-center gap-3 xl:flex">
          <div className="flex flex-col items-end">
            <div
              aria-hidden="true"
              className="h-2.5 w-24 rounded-full border border-line"
              style={{
                background: "linear-gradient(90deg, #56B4E9 0%, #0072B2 45%, #1e293b 65%, #D55E00 100%)",
              }}
            />
            <div className="mt-1 flex w-24 justify-between font-mono text-[10px] text-ink-soft">
              <span>-17dB</span>
              <span>0</span>
              <span>+3dB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status row (RoamingEye style: concise left status + right metadata & compare button) */}
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-1 text-xs text-ink-soft sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          <span aria-hidden="true" className="size-2 rounded-full bg-emerald-400" />
          <span>
            <strong className="text-ink">
              {lang === "pt" ? "Passagem selecionada:" : "Selected pass:"}
            </strong>{" "}
            {compared} ({index + 1}/{steps.length})
          </span>
          {kind && <span className="hidden sm:inline">· {kind}</span>}
          {bulletin && (
            <span>
              · <span className="text-highlight">▼</span>{" "}
              <a
                href={bulletin.url}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-brand-text underline"
              >
                {lang === "pt" ? "Boletim do rio (SGB)" : "River bulletin (SGB)"}
              </a>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden font-mono text-[11px] opacity-80 md:inline">
            NISAR_L2_GCOV · Track 53
          </span>
          <button
            type="button"
            aria-expanded={compareOpen}
            onClick={() => setCompareOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-bold transition ${
              compareOpen
                ? "border-brand bg-brand text-brand-ink"
                : "border-brand/50 bg-brand-soft/60 text-brand-text hover:bg-brand hover:text-brand-ink"
            }`}
          >
            <span>⇄</span>
            <span>
              {lang === "pt"
                ? "Comparar 2 períodos (ex: 1ª vs. Última)"
                : "Compare 2 periods (e.g. 1st vs. Latest)"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
