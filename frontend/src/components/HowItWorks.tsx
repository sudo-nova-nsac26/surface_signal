"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useReducedMotion } from "@/preferences/store";
import { ArrowRightIcon } from "./icons";

type Labels = Dictionary["how"];

// One viewBox for every layer of the drawing, cropped from the sides on
// narrow screens ("slice"), so the important part sits in the middle.
const VIEW = "0 0 1200 500";
const RIVER =
  "M556 236 C626 276 506 316 596 352 S716 412 606 452 S548 492 586 530";

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function House({
  x,
  y,
  w,
  h,
  tall = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  tall?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="var(--scene-town)" />
      {tall ? (
        <g fill="var(--scene-sky)" opacity="0.55">
          <rect x={x + 5} y={y + 7} width="5" height="6" />
          <rect x={x + w - 10} y={y + 7} width="5" height="6" />
          <rect x={x + 5} y={y + 20} width="5" height="6" />
          <rect x={x + w - 10} y={y + 20} width="5" height="6" />
        </g>
      ) : (
        <path
          d={`M${x - 3} ${y + 1} L${x + w / 2} ${y - h * 0.55} L${x + w + 3} ${y + 1} Z`}
          fill="var(--slopes)"
        />
      )}
    </g>
  );
}

function Tree({ x, y, r = 11 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <rect x={x - 2} y={y + r * 0.6} width="4" height={r * 0.8} fill="var(--scene-stroke)" />
      <path
        d={`M${x} ${y - r * 1.6} L${x + r} ${y + r * 0.7} H${x - r} Z`}
        fill="var(--vegetation)"
        opacity="0.55"
      />
    </g>
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

const FLOOD = [
  "M430 344 C470 312 548 318 586 346 C610 372 600 420 560 436 C510 452 446 430 424 400 C412 382 414 360 430 344 Z",
  "M610 300 C654 282 742 290 782 318 C806 340 790 376 748 386 C700 396 640 384 616 360 C600 342 598 312 610 300 Z",
];

/**
 * The valley seen from above at night: hills, fields, Lajeado and Estrela on
 * each bank, the bridge between them. `flooded` draws the river out of its
 * banks over the low houses. Decorative; the text tells the same story.
 */
function Landscape({ flooded, hatch }: { flooded: boolean; hatch: boolean }) {
  const id = flooded ? "after" : "before";
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
        <pattern
          id={`hatch-${id}`}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="14" height="14" fill="var(--water)" />
          <rect width="6" height="14" fill="var(--highlight)" />
        </pattern>
      </defs>

      <rect width="1200" height="500" fill={`url(#sky-${id})`} />
      <g fill="var(--scene-town)">
        {[
          [90, 40], [210, 92], [330, 30], [450, 70], [760, 46], [880, 96],
          [990, 30], [1110, 80], [170, 150], [1040, 150],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" opacity="0.7" />
        ))}
      </g>
      <circle cx="1030" cy="70" r="22" fill="var(--scene-town)" opacity="0.85" />
      <circle cx="1040" cy="64" r="20" fill="var(--bg)" />

      {/* The hills of the Serra, far and near. */}
      <path
        d="M0 200 C140 140 250 180 380 150 C520 116 640 176 780 146 C930 112 1050 168 1200 136 V500 H0 Z"
        fill="var(--scene-hill)"
        opacity="0.7"
      />
      <path
        d="M0 236 C180 196 300 226 430 214 C560 202 700 236 860 214 C1000 196 1100 222 1200 210 V500 H0 Z"
        fill="var(--scene-hill)"
      />
      <path
        d="M0 268 C300 244 900 250 1200 262 V500 H0 Z"
        fill={`url(#land-${id})`}
      />

      {/* Fields and trees. */}
      <g fill="var(--vegetation)" opacity="0.22">
        <rect x="90" y="330" width="150" height="46" rx="6" transform="rotate(-4 165 353)" />
        <rect x="120" y="400" width="190" height="52" rx="6" transform="rotate(-3 215 426)" />
        <rect x="900" y="350" width="170" height="48" rx="6" transform="rotate(3 985 374)" />
        <rect x="940" y="420" width="190" height="50" rx="6" transform="rotate(4 1035 445)" />
      </g>
      {[
        [80, 236], [130, 226], [300, 222], [880, 222], [1010, 214], [1100, 220],
        [270, 300], [930, 300], [370, 440], [820, 440],
      ].map(([x, y]) => (
        <Tree key={`${x}-${y}`} x={x} y={y} />
      ))}

      {/* Riverbanks and the river in its bed. */}
      <path d={RIVER} fill="none" stroke="var(--water-soft)" strokeWidth="46" strokeLinecap="round" />

      {/* Low houses by the river: the first to be reached by the water. */}
      <House x={470} y={372} w={26} h={20} />
      <House x={506} y={394} w={24} h={18} />
      <House x={460} y={404} w={22} h={18} />
      <House x={660} y={326} w={24} h={18} />
      <House x={696} y={346} w={26} h={20} />
      <House x={734} y={330} w={22} h={18} />

      {flooded && (
        <g>
          <g fill="var(--water)" opacity="0.88">
            {FLOOD.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path d={RIVER} fill="none" stroke="var(--water)" strokeWidth="120" strokeLinecap="round" opacity="0.92" />
          {hatch && (
            <g className="scene-pulse">
              {FLOOD.map((d) => (
                <path key={d} d={d} fill={`url(#hatch-${id})`} />
              ))}
              <path d={RIVER} fill="none" stroke={`url(#hatch-${id})`} strokeWidth="120" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}
      <path d={RIVER} fill="none" stroke="var(--water)" strokeWidth="26" strokeLinecap="round" />

      {/* Lajeado (left bank) and Estrela (right bank), on higher ground. */}
      <g>
        <House x={340} y={268} w={26} h={44} tall />
        <House x={372} y={254} w={30} h={58} tall />
        <House x={408} y={276} w={24} h={36} tall />
        <House x={354} y={322} w={26} h={20} />
        <House x={392} y={328} w={24} h={18} />
        <House x={426} y={320} w={26} h={20} />
        <House x={780} y={276} w={26} h={20} />
        <House x={814} y={266} w={30} h={34} tall />
        <House x={852} y={282} w={24} h={20} />
        <House x={800} y={312} w={24} h={18} />
        <House x={836} y={318} w={26} h={20} />
      </g>

      {/* The bridge between the two towns. */}
      <g>
        <rect x="508" y="342" width="190" height="9" rx="2" fill="var(--scene-town)" />
        {[530, 576, 622, 668].map((x) => (
          <rect key={x} x={x} y="351" width="6" height="16" fill="var(--scene-town)" opacity="0.8" />
        ))}
      </g>

      <TownLabel x={390} y={222} text="Lajeado" />
      <TownLabel x={826} y={236} text="Estrela" />
    </svg>
  );
}

/** Satellite, radar echo and clouds, drawn over both halves. */
function Sky({ step }: { step: number }) {
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
        <g className="how-beam" style={{ opacity: step === 0 ? 1 : 0 }}>
          <path d="M600 92 L452 360 H748 Z" fill="var(--highlight)" opacity="0.28" />
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
          <Landscape flooded={false} hatch={false} />
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
          >
            <Landscape flooded hatch={step === 3} />
          </div>
          <Sky step={step} />

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
