"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useReducedMotion } from "@/preferences/store";
import { ArrowRightIcon } from "./icons";
import { VALLEY } from "./valley-scene-data";

type Labels = Dictionary["how"];

// One viewBox for every layer of the drawing, cropped from the sides on
// narrow screens ("slice"), so the important part sits in the middle.
const VIEW = "0 0 1200 500";

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function TownLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const width = text.length * 11 + 26;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - 17}
        width={width}
        height="30"
        rx="15"
        fill="var(--scene-stroke)"
        opacity="0.82"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill="var(--scene-town)"
      >
        {text}
      </text>
    </g>
  );
}

type ImpactLabels = Labels["impacts"];

/** A numbered-free marker: amber dot plus a short label beside it. */
function Pin({
  x,
  y,
  dx = 0,
  dy = -34,
  text,
}: {
  x: number;
  y: number;
  dx?: number;
  dy?: number;
  text: string;
}) {
  const width = text.length * 9.6 + 26;
  const lx = x + dx;
  const ly = y + dy;
  return (
    <g className="rise-in">
      <line x1={x} y1={y} x2={lx} y2={ly} stroke="var(--highlight)" strokeWidth="2" />
      <circle cx={x} cy={y} r="8" fill="var(--highlight)" stroke="var(--scene-stroke)" strokeWidth="2.5" />
      <rect
        x={lx - width / 2}
        y={ly - 15}
        width={width}
        height="28"
        rx="14"
        fill="var(--scene-stroke)"
        stroke="var(--highlight)"
        strokeWidth="2"
      />
      <text x={lx} y={ly + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--highlight)">
        {text}
      </text>
    </g>
  );
}

/**
 * The valley seen from above at night. The river, the streets of Lajeado and
 * Estrela, the main roads and the bridges over the river are real shapes from
 * OpenStreetMap (turned so Lajeado is on the left); the houses sit on real
 * streets. `flooded` shows what a flood does: water in the low streets,
 * houses hit, the bridge broken, ground slid and a field covered. All of that
 * is an illustration, not a measurement.
 */
function Landscape({
  flooded,
  hatch,
  impacts,
}: {
  flooded: boolean;
  hatch: boolean;
  impacts: ImpactLabels | null;
}) {
  const id = flooded ? "after" : "before";
  const { spots } = VALLEY;
  return (
    <svg
      viewBox={VIEW}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bg)" />
          <stop offset="1" stopColor="var(--scene-sky)" />
        </linearGradient>
        <linearGradient id={`land-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-land)" />
          <stop offset="1" stopColor="var(--scene-hill)" />
        </linearGradient>
        <clipPath id={`ground-${id}`}>
          <path d="M0 170 C200 150 420 168 640 156 C860 144 1020 164 1200 150 V500 H0 Z" />
        </clipPath>
        {/* Where the flood reaches: a band around the river. */}
        <mask id={`flood-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="500">
          <rect width="1200" height="500" fill="black" />
          <g fill="none" stroke="white" strokeWidth="140" strokeLinecap="round" strokeLinejoin="round">
            {VALLEY.riverLines.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </mask>
        <pattern
          id={`hatch-${id}`}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="14" height="14" fill="transparent" />
          <rect width="3" height="14" fill="var(--highlight)" />
        </pattern>
      </defs>

      <rect width="1200" height="500" fill={`url(#sky-${id})`} />
      <g fill="var(--scene-town)">
        {[
          [90, 40], [210, 92], [330, 30], [450, 70], [760, 46], [880, 96],
          [990, 30], [1110, 80], [170, 140], [1040, 130],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" opacity="0.7" />
        ))}
      </g>
      <circle cx="1030" cy="70" r="22" fill="var(--scene-town)" opacity="0.85" />
      <circle cx="1040" cy="64" r="20" fill="var(--bg)" />

      {/* The hills of the Serra on the horizon. */}
      <path
        d="M0 176 C140 124 250 160 380 134 C520 106 640 158 780 130 C930 100 1050 150 1200 120 V240 H0 Z"
        fill="var(--scene-hill)"
        opacity="0.75"
      />

      <g clipPath={`url(#ground-${id})`}>
        <rect y="120" width="1200" height="380" fill={`url(#land-${id})`} />

        {/* Fields: after the flood the first one is covered in mud. */}
        {VALLEY.fields.map(([x, y, w, h], index) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="4"
            fill={flooded && index === 0 ? "var(--slopes)" : "var(--vegetation)"}
            opacity={flooded && index === 0 ? 0.85 : 0.5}
          />
        ))}

        <g fill="none" stroke="var(--water)" strokeWidth="2" opacity="0.55" strokeLinecap="round" strokeLinejoin="round">
          {VALLEY.tributaries.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="none" stroke="var(--scene-town)" strokeWidth="0.9" opacity="0.3" strokeLinecap="round" strokeLinejoin="round">
          {VALLEY.streets.map((d) => (
            <path key="streets" d={d} />
          ))}
        </g>
        <g fill="none" stroke="var(--scene-town)" strokeWidth="1.6" opacity="0.38" strokeLinecap="round" strokeLinejoin="round">
          {VALLEY.roads.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Houses and buildings on the real streets. */}
        <g fill="var(--scene-town)" opacity="0.8">
          {VALLEY.houses.map(([x, y, , tall]) => (
            <rect key={`${x}-${y}`} x={x - 2.5} y={tall ? y - 7 : y - 2.5} width="5" height={tall ? 9.5 : 5} rx="0.8" />
          ))}
        </g>

        {flooded && (
          <g mask={`url(#flood-${id})`}>
            {/* Water over the low streets and houses. */}
            <rect width="1200" height="500" fill="var(--water)" opacity="0.5" />
            <g fill="none" stroke="var(--water)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              {VALLEY.streets.map((d) => (
                <path key="streets" d={d} />
              ))}
            </g>
            {hatch && <rect className="scene-pulse" width="1200" height="500" fill={`url(#hatch-${id})`} opacity="0.4" />}
          </g>
        )}
        {flooded && (
          <g fill="var(--scene-town)" fillOpacity="0.45" stroke="var(--highlight)" strokeWidth="1.4">
            {VALLEY.houses
              .filter(([, , hit]) => hit)
              .map(([x, y, , tall]) => (
                <rect key={`${x}-${y}`} x={x - 3} y={tall ? y - 7.5 : y - 3} width="6" height={tall ? 10.5 : 6} rx="1" />
              ))}
          </g>
        )}

        {/* The river inside its banks. */}
        <g fill="var(--water)" stroke="var(--water)" strokeWidth="3" strokeLinejoin="round">
          {VALLEY.rivers.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="none" stroke="var(--water)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
          {VALLEY.riverLines.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Bridges over the river: whole before, broken after. */}
        {VALLEY.bridges.map(({ deck, broken }) =>
          flooded ? (
            <g key={deck} fill="none" strokeLinecap="butt">
              {broken.map((d) => (
                <path key={d} d={d} stroke="var(--scene-stroke)" strokeWidth="9" />
              ))}
              {broken.map((d) => (
                <path key={`${d}-deck`} d={d} stroke="var(--scene-town)" strokeWidth="5" />
              ))}
            </g>
          ) : (
            <g key={deck} fill="none" strokeLinecap="butt">
              <path d={deck} stroke="var(--scene-stroke)" strokeWidth="9" />
              <path d={deck} stroke="var(--scene-town)" strokeWidth="5" />
            </g>
          ),
        )}
      </g>

      {/* Ground that slid down the hillside. */}
      {flooded && (
        <g>
          <path
            d="M786 112 C792 128 806 146 836 176 C812 184 770 184 744 176 C764 158 778 132 786 112 Z"
            fill="var(--slopes)"
            opacity="0.8"
          />
          <path d="M786 120 C784 140 774 158 766 174 M790 128 C796 148 806 162 816 176" fill="none" stroke="var(--scene-stroke)" strokeWidth="2" opacity="0.35" />
          <g fill="var(--slopes)">
            <circle cx="758" cy="182" r="3" />
            <circle cx="806" cy="186" r="2.5" />
            <circle cx="828" cy="182" r="2" />
          </g>
        </g>
      )}

      <TownLabel x={VALLEY.lajeado[0]} y={VALLEY.lajeado[1] - 46} text="Lajeado" />
      <TownLabel x={VALLEY.estrela[0]} y={VALLEY.estrela[1] - 46} text="Estrela" />

      {impacts && (
        <g>
          <Pin x={spots.houses[0]} y={spots.houses[1]} dy={44} text={impacts.houses} />
          <Pin x={spots.streets[0]} y={spots.streets[1]} dy={44} text={impacts.streets} />
          <Pin x={spots.bridge[0]} y={spots.bridge[1]} dx={110} dy={-22} text={impacts.bridge} />
          <Pin x={788} y={150} dx={-40} dy={-50} text={impacts.landslide} />
          <Pin x={spots.crops[0]} y={spots.crops[1]} dx={-50} dy={34} text={impacts.crops} />
        </g>
      )}
    </svg>
  );
}

/** Satellite, radar echo and clouds, drawn over both halves. */
function Sky({ step, still }: { step: number; still: boolean }) {
  const show = (...steps: number[]) => ({
    opacity: steps.includes(step) ? 1 : 0,
  });
  return (
    <svg
      viewBox={VIEW}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
      focusable="false"
    >
      <g className="scene-layer" style={show(0, 1)}>
        <g className="scene-layer" style={{ opacity: step === 0 ? 1 : 0 }}>
          <path d="M600 108 L470 360 H730 Z" fill="var(--highlight)" opacity="0.28">
            {!still && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="-10 600 108; 10 600 108; -10 600 108"
                dur="5.6s"
                repeatCount="indefinite"
              />
            )}
          </path>
        </g>
        <g stroke="var(--scene-stroke)" strokeWidth="2">
          <rect x="508" y="62" width="62" height="28" rx="3" fill="var(--water)" />
          <rect x="630" y="62" width="62" height="28" rx="3" fill="var(--water)" />
          <path d="M529 62 V90 M549 62 V90 M651 62 V90 M671 62 V90" />
          <rect x="574" y="52" width="52" height="48" rx="8" fill="var(--scene-town)" />
          <circle cx="600" cy="108" r="10" fill="var(--scene-town)" />
        </g>
      </g>

      <g className="scene-layer" style={show(1)}>
        <g fill="var(--scene-town)" opacity="0.55">
          <ellipse cx="470" cy="180" rx="96" ry="24" />
          <ellipse cx="530" cy="164" rx="64" ry="22" />
          <ellipse cx="760" cy="196" rx="104" ry="24" />
          <ellipse cx="820" cy="180" rx="56" ry="18" />
        </g>
        <g fill="none" stroke="var(--highlight)" strokeWidth="5" strokeLinecap="round">
          <path className="how-wave" d="M554 136 Q600 160 646 136" />
          <path className="how-wave how-wave-2" d="M530 200 Q600 236 670 200" />
          <path className="how-wave how-wave-3" d="M506 264 Q600 310 694 264" />
        </g>
      </g>
    </svg>
  );
}

export function HowItWorks({ labels }: { labels: Labels }) {
  const [step, setStep] = useState(0);
  const [split, setSplit] = useState(0.5);
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const glide = useRef(0);
  const total = labels.steps.length;
  const current = labels.steps[step];

  // At "compare", the line sweeps once to show that it moves.
  useEffect(() => {
    if (step !== 2 || reduced) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1800);
      setSplit(0.5 + Math.sin(t * Math.PI * 2) * 0.22 * (1 - t * 0.2));
      if (t < 1) glide.current = requestAnimationFrame(tick);
      else setSplit(0.5);
    };
    glide.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(glide.current);
  }, [step, reduced]);

  const moveTo = (clientX: number) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;
    cancelAnimationFrame(glide.current);
    setSplit(Math.min(0.97, Math.max(0.03, (clientX - box.left) / box.width)));
  };

  const pct = Math.round(split * 100);

  return (
    <div className="mt-8 flex flex-col gap-4">
      <figure className="card overflow-hidden rounded-3xl border border-line bg-surface p-2 hc:border-2 sm:p-3">
        <div
          ref={frameRef}
          className="relative aspect-[4/3] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl sm:aspect-[2/1] lg:aspect-[12/5]"
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            moveTo(event.clientX);
          }}
          onPointerMove={(event) => {
            if (dragging.current) moveTo(event.clientX);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          <Landscape flooded={false} hatch={false} impacts={null} />
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
          >
            <Landscape flooded hatch={step === 3} impacts={step === 3 ? labels.impacts : null} />
          </div>
          <Sky step={step} still={reduced} />

          <span className="how-pill left-3 sm:left-4 sm:top-4">{labels.before}</span>
          <span className="how-pill right-3 sm:right-4 sm:top-4">{labels.after}</span>
          <span
            className="how-pill scene-layer bottom-3 right-3 sm:bottom-4 sm:right-4"
            style={{ opacity: step === 3 ? 1 : 0, top: "auto" }}
          >
            <span className="how-swatch" aria-hidden="true" /> {labels.newWater}
          </span>

          {/* The native slider gives keyboard and screen-reader control. */}
          <input
            type="range"
            min={3}
            max={97}
            value={pct}
            onChange={(event) => {
              cancelAnimationFrame(glide.current);
              setSplit(Number(event.target.value) / 100);
            }}
            aria-label={labels.divider}
            aria-valuetext={fill(labels.dividerValue, {
              before: pct,
              after: 100 - pct,
            })}
            className="peer sr-only"
          />
          <div
            aria-hidden="true"
            className="how-line pointer-events-none absolute inset-y-0 -translate-x-1/2"
            style={{ left: `${split * 100}%` }}
          />
          <div
            aria-hidden="true"
            className={`how-handle pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 peer-focus-visible:outline peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-highlight ${
              step === 2 ? "how-handle-hint" : ""
            }`}
            style={{ left: `${split * 100}%` }}
          >
            <svg viewBox="0 0 24 24" width="1.6em" height="1.6em" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
            </svg>
          </div>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2 text-base text-ink-soft">
          <span>{labels.sceneNote}</span>
          <span className="font-bold text-brand-text">↔ {labels.dragHint}</span>
        </figcaption>
      </figure>

      {/* The four steps, side by side; the chosen one is told below. */}
      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {labels.steps.map((item, index) => {
          const active = index === step;
          return (
            <li key={item.title}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => setStep(index)}
                aria-label={item.title}
                className={`flex h-full min-h-16 w-full items-center justify-center gap-3 rounded-2xl sm:justify-start border-2 px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-brand bg-brand-soft hc:border-highlight"
                    : "border-line bg-surface hover:border-brand"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                    active
                      ? "bg-brand text-brand-ink hc:bg-highlight hc:text-highlight-ink"
                      : index < step
                        ? "bg-brand-soft text-brand-text ring-2 ring-brand"
                        : "bg-line text-ink hc:bg-surface hc:outline hc:outline-2 hc:outline-ink"
                  }`}
                >
                  {index < step ? "✓" : index + 1}
                </span>
                <span aria-hidden="true" className="hidden text-lg font-bold leading-tight sm:inline">
                  {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div
        key={step}
        className="rise-in flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 hc:border-2 md:flex-row md:items-center md:justify-between"
      >
        <div className="max-w-3xl" aria-live="polite">
          <p className="text-base font-bold text-brand-text">
            {fill(labels.stepOf, { current: step + 1, total })}
          </p>
          <h3 className="mt-1 text-2xl font-bold">{current.title}</h3>
          <p className="mt-2 text-xl text-ink-soft">{current.body}</p>
          <p className="mt-3 border-l-4 border-highlight pl-3 text-lg">{current.detail}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (step < total - 1) {
              setStep(step + 1);
              return;
            }
            // Last step: carry on down the page instead of starting over.
            document.getElementById("layers")?.scrollIntoView({ block: "start" });
          }}
          className="pressable inline-flex min-h-14 shrink-0 items-center justify-center gap-3 self-start rounded-2xl border-2 border-transparent bg-brand px-6 text-xl font-bold text-brand-ink hc:border-ink md:self-center"
        >
          {step < total - 1 ? labels.next : labels.continue}
          <ArrowRightIcon className={step < total - 1 ? "" : "rotate-90"} />
        </button>
      </div>
    </div>
  );
}
