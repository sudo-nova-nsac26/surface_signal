"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useReducedMotion } from "@/preferences/store";
import { ArrowRightIcon } from "./icons";

type Labels = Dictionary["how"];

const W = 640;
const H = 300;
const RIVER = "M300 118 C372 156 236 186 312 222 S392 262 336 300";

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

/**
 * The explanatory drawing. Left of the line is the valley before the flood,
 * right of it the same valley during the flood. Each step adds a layer
 * (satellite, radar echo, dates, new water). Plain SVG and CSS so it stays
 * light on slow phones; it is decorative, the text tells the same story.
 */
function Scene({ step, split }: { step: number; split: number }) {
  const show = (...indexes: number[]) => ({
    opacity: indexes.includes(step) ? 1 : 0,
  });
  const x = split * W;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="how-before">
          <rect width={x} height={H} />
        </clipPath>
        <clipPath id="how-after">
          <rect x={x} width={W - x} height={H} />
        </clipPath>
        <pattern
          id="how-hatch"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="10" height="10" fill="var(--water)" />
          <rect width="4" height="10" fill="var(--highlight)" />
        </pattern>
        <linearGradient id="how-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bg)" />
          <stop offset="1" stopColor="var(--scene-sky)" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#how-sky)" />
      {/* A few stars: it was night at the pass. */}
      <g fill="var(--scene-town)" opacity="0.7">
        <circle cx="40" cy="22" r="1.4" />
        <circle cx="120" cy="56" r="1" />
        <circle cx="210" cy="18" r="1.2" />
        <circle cx="470" cy="30" r="1.4" />
        <circle cx="560" cy="64" r="1" />
        <circle cx="610" cy="20" r="1.2" />
      </g>
      <path
        d="M0 118 Q90 62 190 104 T380 92 T640 108 V300 H0 Z"
        fill="var(--scene-hill)"
      />
      <path
        d="M0 140 Q140 116 300 134 T640 130 V300 H0 Z"
        fill="var(--scene-land)"
      />
      {/* Fields, so the land is not empty. */}
      <g fill="var(--vegetation)" opacity="0.28">
        <rect x="36" y="232" width="70" height="26" rx="4" />
        <rect x="520" y="244" width="80" height="26" rx="4" />
        <rect x="560" y="150" width="54" height="20" rx="4" />
      </g>

      {/* Before: the river inside its banks. */}
      <g clipPath="url(#how-before)">
        <path d={RIVER} fill="none" stroke="var(--water)" strokeWidth="18" strokeLinecap="round" />
      </g>

      {/* Houses: two towns, plus a few low houses close to the river. */}
      <g fill="var(--scene-town)" stroke="var(--scene-stroke)" strokeWidth="1.5">
        <rect x="104" y="170" width="24" height="18" rx="2" />
        <rect x="134" y="162" width="18" height="26" rx="2" />
        <rect x="116" y="198" width="30" height="16" rx="2" />
        <rect x="456" y="176" width="26" height="18" rx="2" />
        <rect x="488" y="168" width="18" height="26" rx="2" />
        <rect x="468" y="204" width="30" height="16" rx="2" />
        <rect x="222" y="232" width="20" height="15" rx="2" />
        <rect x="250" y="250" width="18" height="14" rx="2" />
        <rect x="380" y="212" width="20" height="15" rx="2" />
        <rect x="402" y="232" width="18" height="14" rx="2" />
      </g>

      {/* After: the river out of its banks, over the low houses. */}
      <g clipPath="url(#how-after)">
        <g fill="var(--water)" opacity="0.92">
          <ellipse cx="250" cy="248" rx="80" ry="26" />
          <ellipse cx="392" cy="224" rx="70" ry="22" />
        </g>
        <path d={RIVER} fill="none" stroke="var(--water)" strokeWidth="64" strokeLinecap="round" />
        {/* Step 4: the new water, hatched so it reads without colour. */}
        <g className="scene-layer" style={show(3)}>
          <g className="scene-pulse" fill="url(#how-hatch)">
            <ellipse cx="250" cy="248" rx="80" ry="26" />
            <ellipse cx="392" cy="224" rx="70" ry="22" />
            <path d={RIVER} fill="none" stroke="url(#how-hatch)" strokeWidth="64" strokeLinecap="round" />
          </g>
          {/* The normal river stays solid: only what is new is hatched. */}
          <path d={RIVER} fill="none" stroke="var(--water)" strokeWidth="18" strokeLinecap="round" />
        </g>
      </g>

      {/* Steps 1 and 2: the satellite. */}
      <g className="scene-layer" style={show(0, 1)}>
        <g className="how-beam" style={{ opacity: step === 0 ? 1 : 0 }}>
          <path d="M320 46 L240 210 H400 Z" fill="var(--highlight)" opacity="0.35" />
        </g>
        <g stroke="var(--scene-stroke)" strokeWidth="1.5">
          <rect x="280" y="34" width="28" height="16" fill="var(--water)" />
          <rect x="332" y="34" width="28" height="16" fill="var(--water)" />
          <rect x="308" y="28" width="24" height="28" rx="4" fill="var(--scene-town)" />
        </g>
      </g>

      {/* Step 2: clouds, and the radar echo going through them. */}
      <g className="scene-layer" style={show(1)}>
        <g fill="var(--scene-town)" opacity="0.5">
          <ellipse cx="250" cy="96" rx="58" ry="16" />
          <ellipse cx="292" cy="86" rx="40" ry="14" />
          <ellipse cx="420" cy="104" rx="64" ry="15" />
          <ellipse cx="458" cy="94" rx="36" ry="12" />
        </g>
        <g fill="none" stroke="var(--highlight)" strokeWidth="3" strokeLinecap="round">
          <path className="how-wave" d="M290 80 Q320 96 350 80" />
          <path className="how-wave how-wave-2" d="M276 120 Q320 142 364 120" />
          <path className="how-wave how-wave-3" d="M262 160 Q320 188 378 160" />
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
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <figure className="card overflow-hidden rounded-3xl border border-line bg-surface p-3 hc:border-2">
        <div
          ref={frameRef}
          className="relative cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl"
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
          <Scene step={step} split={split} />

          {/* Date labels as text, so they translate and stay sharp. */}
          <span className="how-pill left-3">{labels.before}</span>
          <span className="how-pill right-3">{labels.after}</span>
          <span
            className="how-pill scene-layer bottom-3 left-1/2 -translate-x-1/2"
            style={{ opacity: step === 3 ? 1 : 0, top: "auto" }}
          >
            {labels.newWater}
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
            <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
            </svg>
            <span className="sr-only">{labels.dragHint}</span>
          </div>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3 text-base text-ink-soft">
          <span>{labels.sceneNote}</span>
          <span className="font-bold text-brand-text">↔ {labels.dragHint}</span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-3">
        <div
          className="flex gap-1.5"
          role="presentation"
          aria-hidden="true"
        >
          {labels.steps.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= step ? "bg-brand hc:bg-highlight" : "bg-line"
              }`}
            />
          ))}
        </div>
        <p className="text-base font-bold text-ink-soft" aria-live="polite">
          {fill(labels.stepOf, { current: step + 1, total })}
        </p>

        <ol className="flex flex-col gap-2">
          {labels.steps.map((item, index) => {
            const active = index === step;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  aria-expanded={active}
                  onClick={() => setStep(index)}
                  className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors ${
                    active
                      ? "border-brand bg-brand-soft hc:border-highlight"
                      : "border-line bg-surface hover:border-brand"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                      active
                        ? "bg-brand text-brand-ink hc:bg-highlight hc:text-highlight-ink"
                        : index < step
                          ? "bg-brand-soft text-brand-text ring-2 ring-brand"
                          : "bg-line text-ink hc:bg-surface hc:outline hc:outline-2 hc:outline-ink"
                    }`}
                  >
                    {index < step ? "✓" : index + 1}
                  </span>
                  <span>
                    <span className="block text-xl font-bold">{item.title}</span>
                    <span className="block text-ink-soft">{item.body}</span>
                    {active && (
                      <span className="rise-in mt-2 block border-l-4 border-highlight pl-3 text-base text-ink">
                        {item.detail}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

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
          className="pressable mt-1 inline-flex min-h-14 items-center justify-center gap-3 self-start rounded-2xl border-2 border-transparent bg-brand px-6 text-xl font-bold text-brand-ink hc:border-ink"
        >
          {step < total - 1 ? labels.next : labels.continue}
          <ArrowRightIcon className={step < total - 1 ? "" : "rotate-90"} />
        </button>
      </div>
    </div>
  );
}
